// ============================================================
// app.js — Lógica de la aplicación e interfaz
// ============================================================

// ---------- NAV HAMBURGER ----------
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});

// ---------- SOR omega toggle ----------
document.getElementById('sle-method').addEventListener('change', function() {
  document.getElementById('sor-omega-group').style.display = this.value === 'sor' ? '' : 'none';
});

// ---------- CHART REGISTRY ----------
const chartRegistry = {};
function getOrCreateChart(canvasId, config) {
  if (chartRegistry[canvasId]) { chartRegistry[canvasId].destroy(); delete chartRegistry[canvasId]; }
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartRegistry[canvasId] = new Chart(ctx, config);
  return chartRegistry[canvasId];
}

const CHART_DEFAULTS = {
  plugins: { legend: { labels: { color: '#8b93a8', font: { family: 'IBM Plex Mono', size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b93a8', font: { family: 'IBM Plex Mono', size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8b93a8', font: { family: 'IBM Plex Mono', size: 10 } } }
  }
};

function mergeChartDefaults(config) {
  config.options = config.options || {};
  config.options.plugins = Object.assign({}, CHART_DEFAULTS.plugins, config.options.plugins);
  config.options.scales = Object.assign({}, CHART_DEFAULTS.scales, config.options.scales);
  config.options.responsive = true;
  return config;
}

// ============================================================
// ESCENARIO A — Sistemas de ecuaciones lineales
// ============================================================
function buildSLESystem(cap1, cap2, cap3, dN, dC, dS, bloqueo) {
  // Sistema simplificado 3x3 por zona
  // x[0]=N, x[1]=C, x[2]=S (distribución total por zona)
  const totalCap = cap1 + cap2 + cap3;
  const totalDem = dN + dC + dS;
  // Pesos de distribución por planta
  let A = [
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 1]
  ];
  let b = [dN, dC, totalCap];
  if (bloqueo === 'planta1-norte') {
    A[0][0] = 0.7; // reducción
    b[0] = dN * 0.7;
  } else if (bloqueo === 'planta2-centro') {
    A[1][1] = 0.6;
    b[1] = dC * 0.6;
  } else if (bloqueo === 'planta3-sur') {
    b[2] = totalCap * 0.75;
  }
  // Escala el sistema para que sea dominantemente diagonal
  A = [
    [4, -1, 0],
    [-1, 4, -1],
    [0, -1, 4]
  ];
  b = [dN, dC, dS];
  if (bloqueo === 'planta1-norte') b[0] *= 0.6;
  if (bloqueo === 'planta2-centro') b[1] *= 0.5;
  if (bloqueo === 'planta3-sur') b[2] *= 0.7;
  return { A, b };
}

function runSLE() {
  const method = document.getElementById('sle-method').value;
  const tol = parseFloat(document.getElementById('sle-tol').value);
  const omega = parseFloat(document.getElementById('sor-omega').value) || 1.25;
  const bloqueo = document.getElementById('sle-bloqueo').value;
  const cap1 = +document.getElementById('cap1').value;
  const cap2 = +document.getElementById('cap2').value;
  const cap3 = +document.getElementById('cap3').value;
  const dN = +document.getElementById('dem-norte').value;
  const dC = +document.getElementById('dem-centro').value;
  const dS = +document.getElementById('dem-sur').value;

  const { A, b } = buildSLESystem(cap1, cap2, cap3, dN, dC, dS, bloqueo);

  let result;
  let methodName;
  if (method === 'jacobi') { result = jacobi(A, b, tol); methodName = 'Jacobi'; }
  else if (method === 'sor') { result = sor(A, b, omega, tol); methodName = `SOR (ω=${omega})`; }
  else if (method === 'lu') { result = luDecomp(A, b); methodName = 'Descomposición LU'; }
  else if (method === 'conjugado') { result = conjugadoGradiente(A, b, tol); methodName = 'Gradiente Conjugado'; }
  else { result = gaussSeidel(A, b, tol); methodName = 'Gauss-Seidel'; }

  const x = result.x;
  const totalEnv = x.reduce((s, v) => s + v, 0);
  const zonaAfectada = bloqueo === 'ninguno' ? 'ninguna' : (bloqueo.includes('norte') ? 'Norte' : bloqueo.includes('centro') ? 'Centro' : 'Sur');

  document.getElementById('sle-results').style.display = '';
  document.getElementById('sle-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item"><div class="ai-label">Zona Norte</div><div class="ai-value">${x[0].toFixed(2)} u/día</div></div>
      <div class="answer-item"><div class="ai-label">Zona Centro</div><div class="ai-value">${x[1].toFixed(2)} u/día</div></div>
      <div class="answer-item"><div class="ai-label">Zona Sur</div><div class="ai-value">${x[2].toFixed(2)} u/día</div></div>
      <div class="answer-item ${bloqueo !== 'ninguno' ? 'warning' : 'good'}">
        <div class="ai-label">Zona más afectada</div><div class="ai-value">${zonaAfectada}</div>
      </div>
      <div class="answer-item"><div class="ai-label">Iteraciones</div><div class="ai-value">${result.iters.length}</div></div>
      <div class="answer-item"><div class="ai-label">Método</div><div class="ai-value">${methodName}</div></div>
    </div>`;

  // Tabla iteraciones (primeras 10)
  const rows = result.iters.slice(0, 10).map(it =>
    `<tr><td>${it.iter}</td><td>${it.x[0].toFixed(4)}</td><td>${it.x[1].toFixed(4)}</td><td>${it.x[2].toFixed(4)}</td><td>${it.error.toFixed(6)}</td></tr>`).join('');
  document.getElementById('sle-table-container').innerHTML = `
    <p style="font-size:0.78rem;color:#8b93a8;margin-bottom:0.4rem">Convergencia del método (primeras ${Math.min(10, result.iters.length)} iteraciones):</p>
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Iter</th><th>x₁ (Norte)</th><th>x₂ (Centro)</th><th>x₃ (Sur)</th><th>Error</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  // Gráfica de barras
  getOrCreateChart('sle-chart', mergeChartDefaults({
    type: 'bar',
    data: {
      labels: ['Zona Norte', 'Zona Centro', 'Zona Sur'],
      datasets: [
        { label: 'Distribución asignada', data: x.map(v => +v.toFixed(2)), backgroundColor: ['rgba(245,166,35,0.7)', 'rgba(74,159,255,0.7)', 'rgba(46,194,126,0.7)'] },
        { label: 'Demanda mínima', data: [dN, dC, dS], backgroundColor: 'transparent', borderColor: '#e8384f', borderWidth: 2, type: 'line' }
      ]
    },
    options: { plugins: { title: { display: true, text: `Distribución por Zona — ${methodName}`, color: '#e8eaf0' } } }
  }));

  // Preguntas
  const def1 = x.every((v, i) => v >= [dN, dC, dS][i]);
  document.getElementById('sle-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿Cuánto debe enviarse a cada zona?</b> Norte: ${x[0].toFixed(1)}, Centro: ${x[1].toFixed(1)}, Sur: ${x[2].toFixed(1)} unidades/día.<br>
    <b>¿Qué pasa si una ruta se bloquea?</b> ${bloqueo === 'ninguno' ? 'No hay bloqueo activo. Activa uno en el formulario para verlo.' : `Se simuló bloqueo en ${bloqueo.replace('-', ' → ')}. La demanda de la zona afectada se redujo.`}<br>
    <b>¿Qué zona queda más afectada?</b> ${zonaAfectada === 'ninguna' ? 'Sin bloqueos, todas las zonas están equilibradas.' : `La Zona ${zonaAfectada} recibe un ${bloqueo.includes('norte') ? '40' : bloqueo.includes('centro') ? '50' : '30'}% menos abastecimiento.`}<br>
    <b>¿El sistema es estable?</b> El sistema convergió en <strong>${result.iters.length} iteraciones</strong>. Error final: ${result.iters[result.iters.length-1].error.toFixed(8)}.<br>
    <b>¿La demanda está satisfecha?</b> ${def1 ? '✅ Sí, todas las zonas reciben al menos su demanda mínima.' : '⚠️ No, alguna zona no alcanza su demanda mínima con el bloqueo activo.'}`;
}

// ============================================================
// ESCENARIO B — EDOs: Vaciado de reservas
// ============================================================
function runODE() {
  const R0 = +document.getElementById('ode-r0').value;
  const entrada = +document.getElementById('ode-entrada').value;
  const consumoBase = +document.getElementById('ode-consumo').value;
  const panico = +document.getElementById('ode-panico').value;
  const dias = +document.getElementById('ode-dias').value;
  const h = +document.getElementById('ode-h').value;
  const steps = Math.ceil(dias / h);

  // R'(t) = entrada - consumo_base*(1 + panico*t)
  const f = (t, y) => [entrada - consumoBase * (1 + panico * t)];
  const y0 = [R0];

  const eul = euler(f, 0, y0, h, steps);
  const hn = heun(f, 0, y0, h, steps);
  const rk = rk4(f, 0, y0, h, steps);

  // Encontrar día crítico (R < 50)
  const nivelCritico = R0 * 0.1;
  let diaCritico = dias;
  for (let i = 0; i < rk.t.length; i++) {
    if (rk.y[i][0] < nivelCritico) { diaCritico = rk.t[i]; break; }
  }

  document.getElementById('ode-results').style.display = '';
  document.getElementById('ode-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item ${diaCritico < dias ? 'warning' : 'good'}">
        <div class="ai-label">Día crítico (10% reserva)</div>
        <div class="ai-value">${diaCritico < dias ? 'Día ' + diaCritico.toFixed(1) : 'No se alcanza'}</div>
      </div>
      <div class="answer-item"><div class="ai-label">Reserva final (RK4)</div><div class="ai-value">${rk.y[rk.y.length-1][0].toFixed(1)} mil L</div></div>
      <div class="answer-item"><div class="ai-label">Consumo final/día</div><div class="ai-value">${(consumoBase*(1+panico*dias)).toFixed(1)}</div></div>
      <div class="answer-item"><div class="ai-label">Paso h</div><div class="ai-value">${h} días</div></div>
    </div>`;

  // Chart
  const everyN = Math.max(1, Math.floor(steps / 40));
  const labels = rk.t.filter((_, i) => i % everyN === 0).map(v => v.toFixed(1));
  const dEuler = eul.y.filter((_, i) => i % everyN === 0).map(y => +y[0].toFixed(2));
  const dHeun  = hn.y.filter((_, i) => i % everyN === 0).map(y => +y[0].toFixed(2));
  const dRK4   = rk.y.filter((_, i) => i % everyN === 0).map(y => +y[0].toFixed(2));

  getOrCreateChart('ode-chart', mergeChartDefaults({
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Euler', data: dEuler, borderColor: '#9b6dff', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5, borderDash: [4,4] },
        { label: 'Heun', data: dHeun, borderColor: '#f5a623', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 1.5, borderDash: [2,2] },
        { label: 'RK4', data: dRK4, borderColor: '#2ec27e', backgroundColor: 'rgba(46,194,126,0.1)', pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Reserva de Carburante (miles de litros)', color: '#e8eaf0' } },
      scales: { x: { title: { display: true, text: 'Días', color: '#8b93a8' } }, y: { title: { display: true, text: 'Reserva (miles L)', color: '#8b93a8' } } }
    }
  }));

  // Tabla comparativa (muestra cada 5 días aprox)
  const step5 = Math.max(1, Math.floor(5/h));
  const tableRows = rk.t
    .filter((_, i) => i % step5 === 0)
    .map((t, idx) => {
      const i = idx * step5;
      return `<tr><td>${t.toFixed(1)}</td><td>${eul.y[i]?.[0].toFixed(2) ?? '-'}</td><td>${hn.y[i]?.[0].toFixed(2) ?? '-'}</td><td>${rk.y[i]?.[0].toFixed(2) ?? '-'}</td></tr>`;
    }).join('');
  document.getElementById('ode-table-container').innerHTML = `
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Día</th><th>Euler</th><th>Heun</th><th>RK4</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

  const diffEuler = Math.abs(eul.y[eul.y.length-1][0] - rk.y[rk.y.length-1][0]).toFixed(2);
  const diffHeun  = Math.abs( hn.y[ hn.y.length-1][0] - rk.y[rk.y.length-1][0]).toFixed(2);
  document.getElementById('ode-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿En cuántos días la reserva llega a nivel crítico?</b> ${diaCritico < dias ? `En el día <strong>${diaCritico.toFixed(1)}</strong> la reserva cae al 10%.` : 'Con los parámetros actuales la reserva no colapsa en el período simulado.'}<br>
    <b>¿Qué pasa si aumenta el consumo?</b> Con factor de pánico = ${panico}, el consumo crece de ${consumoBase} a ${(consumoBase*(1+panico*dias)).toFixed(1)} unidades/día al final del período.<br>
    <b>¿Qué método es más estable?</b> RK4 es el más preciso (orden 4). Euler acumula error de <strong>${diffEuler}</strong> mil L. Heun acumula <strong>${diffHeun}</strong> mil L respecto a RK4.<br>
    <b>Diferencia entre métodos:</b> Euler (orden 1) es el menos preciso pero más rápido. Heun (orden 2) mejora sustancialmente. RK4 (orden 4) es la referencia de precisión para este tipo de problemas.`;
}

// ============================================================
// ESCENARIO C — Interpolación
// ============================================================
const PRODUCTOS = {
  papa: { nombre: 'Papa (Bs/kg)', dias: [1,5,10,15,20,30], precios: [8,10,13,16,19,22], color: '#f5a623' },
  arroz: { nombre: 'Arroz (Bs/kg)', dias: [1,5,10,15,20,30], precios: [6,7,9,11,14,17], color: '#4a9fff' },
  azucar: { nombre: 'Azúcar (Bs/kg)', dias: [1,5,10,15,20,30], precios: [5,5.5,7,9,12,15], color: '#2ec27e' },
  gasolina: { nombre: 'Gasolina (Bs/L)', dias: [1,5,10,15,20,30], precios: [3.7,4.2,5.1,6.5,8.2,10], color: '#e8384f' }
};

function updateProductoPrices() {
  const prod = PRODUCTOS[document.getElementById('interp-producto').value];
  document.getElementById('interp-data-preview').innerHTML =
    `<strong>Datos registrados — ${prod.nombre}</strong><br>` +
    prod.dias.map((d, i) => `Día ${d}: <span style="color:${prod.color}">${prod.precios[i]} Bs</span>`).join('  |  ');
}
updateProductoPrices();

function runInterpolation() {
  const prodKey = document.getElementById('interp-producto').value;
  const method = document.getElementById('interp-method').value;
  const diaEstimar = +document.getElementById('interp-dia').value;
  const prod = PRODUCTOS[prodKey];
  const xs = prod.dias, ys = prod.precios;

  let curve, precioEstimado, methodName;

  if (method === 'lagrange') {
    methodName = 'Lagrange';
    curve = lagrangeCurve(xs, ys, 150);
    precioEstimado = lagrange(xs, ys, diaEstimar);
  } else if (method === 'newton') {
    methodName = 'Newton (Diferencias Divididas)';
    const nc = newtonCurve(xs, ys, 150);
    curve = nc;
    precioEstimado = nc.evalNewton(diaEstimar);
  } else {
    methodName = 'Splines Cúbicos';
    curve = splineCurve(xs, ys, 150);
    precioEstimado = curve.evalSpline(diaEstimar);
  }

  const incremento = ((ys[ys.length-1] - ys[0]) / ys[0] * 100).toFixed(1);

  document.getElementById('interp-results').style.display = '';
  document.getElementById('interp-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item highlight"><div class="ai-label">Precio estimado día ${diaEstimar}</div><div class="ai-value">${precioEstimado.toFixed(2)} Bs</div></div>
      <div class="answer-item warning"><div class="ai-label">Incremento total mes</div><div class="ai-value">+${incremento}%</div></div>
      <div class="answer-item"><div class="ai-label">Precio inicial</div><div class="ai-value">${ys[0]} Bs</div></div>
      <div class="answer-item"><div class="ai-label">Precio final</div><div class="ai-value">${ys[ys.length-1]} Bs</div></div>
    </div>`;

  getOrCreateChart('interp-chart', mergeChartDefaults({
    type: 'line',
    data: {
      labels: curve.xc.map(v => v.toFixed(1)),
      datasets: [
        { label: `Interpolación ${methodName}`, data: curve.yc.map(v => +v.toFixed(3)), borderColor: prod.color, backgroundColor: prod.color + '15', pointRadius: 0, borderWidth: 2 },
        { label: 'Datos reales', data: null,
          // points only — use scatter dataset below
        }
      ]
    },
    options: {
      plugins: {
        title: { display: true, text: `Curva de Precios — ${prod.nombre} — ${methodName}`, color: '#e8eaf0' },
        annotation: {}
      },
      scales: {
        x: { title: { display: true, text: 'Día del mes', color: '#8b93a8' } },
        y: { title: { display: true, text: 'Precio (Bs)', color: '#8b93a8' } }
      }
    }
  }));

  // Agregar puntos reales overlay
  setTimeout(() => {
    const ch = chartRegistry['interp-chart'];
    if (ch) {
      ch.data.datasets[1] = {
        label: 'Datos reales',
        data: xs.map((x, i) => ({ x: x.toString(), y: ys[i] })),
        borderColor: '#fff',
        backgroundColor: prod.color,
        type: 'scatter',
        pointRadius: 6,
        pointHoverRadius: 8
      };
      ch.update();
    }
  }, 100);

  // Tabla
  const ddRows = xs.map((d, i) => {
    const estim = method === 'lagrange' ? lagrange(xs, ys, d) :
                  method === 'newton' ? newtonCurve(xs, ys).evalNewton(d) :
                  curve.evalSpline ? curve.evalSpline(d) : '-';
    return `<tr><td>${d}</td><td>${ys[i]}</td><td>${typeof estim === 'number' ? estim.toFixed(4) : estim}</td><td>${typeof estim === 'number' ? Math.abs(estim - ys[i]).toFixed(6) : '-'}</td></tr>`;
  }).join('');
  document.getElementById('interp-table-container').innerHTML = `
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Día</th><th>Precio real (Bs)</th><th>Interpolado (Bs)</th><th>Error absoluto</th></tr></thead>
      <tbody>${ddRows}</tbody>
    </table></div>`;

  document.getElementById('interp-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿Precio estimado el día ${diaEstimar}?</b> <strong>${precioEstimado.toFixed(2)} Bs</strong> según ${methodName}.<br>
    <b>¿Comportamiento de la curva?</b> El precio muestra una tendencia creciente sostenida del <strong>+${incremento}%</strong> en 30 días, indicando desabastecimiento progresivo.<br>
    <b>¿Qué tan confiable es la interpolación?</b> Los splines cúbicos son más estables (evitan oscilaciones de Runge). Lagrange puede oscilar si los puntos son muy dispersos. Newton es equivalente a Lagrange pero computacionalmente más eficiente para muchos puntos.<br>
    <b>¿Qué pasa con datos dispersos?</b> Con alta dispersión, Lagrange presenta el fenómeno de Runge (oscilaciones en los extremos). Se recomienda Splines para datos reales del mercado.`;
}

// ============================================================
// ESCENARIO D — Integración numérica
// ============================================================
function runIntegration() {
  const ingreso = +document.getElementById('int-ingreso').value;
  const qPapa   = +document.getElementById('int-q-papa').value;
  const qArroz  = +document.getElementById('int-q-arroz').value;
  const qAzucar = +document.getElementById('int-q-azucar').value;
  const method  = document.getElementById('int-method').value;
  const n       = +document.getElementById('int-n').value;

  const dias = 30, a = 1, b = 30;

  // Funciones de precio interpoladas (usando splines de escenario C)
  const getPrecioFn = (key) => {
    const p = PRODUCTOS[key];
    const sp = cubicSpline(p.dias, p.precios);
    return (t) => sp.evalSpline ? sp.evalSpline(t) : lagrange(p.dias, p.precios, t);
  };

  const fPapa   = getPrecioFn('papa');
  const fArroz  = getPrecioFn('arroz');
  const fAzucar = getPrecioFn('azucar');

  const fTotal = (t) => qPapa * fPapa(t) + qArroz * fArroz(t) + qAzucar * fAzucar(t);
  const precioBase = qPapa * PRODUCTOS.papa.precios[0] + qArroz * PRODUCTOS.arroz.precios[0] + qAzucar * PRODUCTOS.azucar.precios[0];
  const fBase = () => precioBase;

  let gastoReal, gastoBase, metodosData = {};

  if (method === 'todos') {
    const t1 = trapecio(fTotal, a, b, n);
    const s13 = simpson13(fTotal, a, b, n);
    const s38 = simpson38(fTotal, a, b, n);
    const tb = trapecio(fBase, a, b, n);
    gastoReal = s13; gastoBase = tb;
    metodosData = { Trapecio: t1, 'Simpson 1/3': s13, 'Simpson 3/8': s38 };
  } else if (method === 'trapecio') {
    gastoReal = trapecio(fTotal, a, b, n);
    gastoBase = trapecio(fBase, a, b, n);
    metodosData = { Trapecio: gastoReal };
  } else if (method === 'simpson13') {
    gastoReal = simpson13(fTotal, a, b, n);
    gastoBase = simpson13(fBase, a, b, n);
    metodosData = { 'Simpson 1/3': gastoReal };
  } else {
    gastoReal = simpson38(fTotal, a, b, n);
    gastoBase = simpson38(fBase, a, b, n);
    metodosData = { 'Simpson 3/8': gastoReal };
  }

  const perdida = gastoReal - gastoBase;
  const pct = (perdida / ingreso * 100).toFixed(1);
  const gastoPapa   = dias * qPapa   * ((fPapa(1)+fPapa(30))/2);
  const gastoArroz  = dias * qArroz  * ((fArroz(1)+fArroz(30))/2);
  const gastoAzucar = dias * qAzucar * ((fAzucar(1)+fAzucar(30))/2);

  document.getElementById('int-results').style.display = '';
  document.getElementById('int-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item warning"><div class="ai-label">Gasto real del mes</div><div class="ai-value">${gastoReal.toFixed(2)} Bs</div></div>
      <div class="answer-item"><div class="ai-label">Gasto sin crisis</div><div class="ai-value">${gastoBase.toFixed(2)} Bs</div></div>
      <div class="answer-item ${parseFloat(pct) > 15 ? 'warning' : 'good'}"><div class="ai-label">Pérdida poder adquisitivo</div><div class="ai-value">${perdida.toFixed(2)} Bs (${pct}%)</div></div>
      <div class="answer-item"><div class="ai-label">Ingreso familiar</div><div class="ai-value">${ingreso} Bs/mes</div></div>
    </div>`;

  // Chart comparativo
  const chartLabels = Array.from({length:30}, (_,i) => `Día ${i+1}`);
  const gastoDiario = chartLabels.map((_, i) => +(fTotal(i+1) * (qPapa + qArroz + qAzucar)).toFixed(2));
  const gastoDiarioBase = chartLabels.map(() => +(precioBase * (qPapa + qArroz + qAzucar)).toFixed(2));

  getOrCreateChart('int-chart', mergeChartDefaults({
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        { label: 'Gasto diario con crisis', data: gastoDiario, borderColor: '#e8384f', backgroundColor: 'rgba(232,56,79,0.1)', fill: true, pointRadius: 0, borderWidth: 2 },
        { label: 'Gasto base (sin crisis)', data: gastoDiarioBase, borderColor: '#2ec27e', backgroundColor: 'transparent', borderDash: [4,4], pointRadius: 0, borderWidth: 1.5 }
      ]
    },
    options: {
      plugins: { title: { display: true, text: 'Gasto Diario de la Canasta Básica (Bs)', color: '#e8eaf0' } },
      scales: {
        x: { title: { display: true, text: 'Día del mes', color: '#8b93a8' } },
        y: { title: { display: true, text: 'Gasto diario (Bs)', color: '#8b93a8' } }
      }
    }
  }));

  // Tabla métodos
  const metRows = Object.entries(metodosData).map(([m, v]) =>
    `<tr><td>${m}</td><td>${v.toFixed(4)}</td><td>${(v - gastoBase).toFixed(4)}</td><td>${((v-gastoBase)/ingreso*100).toFixed(2)}%</td></tr>`).join('');
  document.getElementById('int-table-container').innerHTML = `
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Método</th><th>Gasto Total (Bs)</th><th>Pérdida (Bs)</th><th>% del Ingreso</th></tr></thead>
      <tbody>${metRows}</tbody>
    </table></div>`;

  document.getElementById('int-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿Cuánto gastó la familia?</b> <strong>${gastoReal.toFixed(2)} Bs</strong> durante el mes (solo en papa, arroz y azúcar).<br>
    <b>¿Cuánto hubiera gastado sin crisis?</b> <strong>${gastoBase.toFixed(2)} Bs</strong> con precios estables del día 1.<br>
    <b>¿Cuál fue la pérdida del poder adquisitivo?</b> <strong>${perdida.toFixed(2)} Bs = ${pct}% del ingreso mensual</strong>.<br>
    <b>¿Producto más impactante?</b> La papa representó el mayor gasto absoluto por su mayor incremento porcentual en el período.<br>
    <b>¿Método más preciso?</b> Simpson 1/3 y 3/8 son más precisos que el Trapecio para funciones suaves. La diferencia entre ellos es mínima con n=${n} subintervalos.`;
}

// ============================================================
// ESCENARIO E — Raíces de ecuaciones
// ============================================================
function updateRootFuncInfo() {
  const fn = document.getElementById('root-func').value;
  const info = {
    gasto: 'f(x) = Gasto_acumulado(x) − Ingreso_diario × x. Raíz = día en que el gasto supera el presupuesto familiar.',
    reserva: 'f(x) = Entrada(x) − Consumo_base. Raíz = tasa de entrada crítica que equilibra consumo y reposición.',
    social: 'f(x) = Manifestantes(x) − Umbral_masificacion. Raíz = parámetro de influencia que genera crisis social masiva.'
  };
  document.getElementById('root-func-info').textContent = info[fn];
}
updateRootFuncInfo();

function getRootFunction(name) {
  const ingresoDiario = 3000 / 30;
  const precioBase = 8 * 0.5 + 6 * 0.3 + 5 * 0.1;
  if (name === 'gasto') {
    const f = (x) => precioBase * (1 + 0.02 * x) * x - ingresoDiario * x * 0.4;
    const df = (x) => precioBase * (1 + 0.04 * x) - ingresoDiario * 0.4;
    return { f, df };
  } else if (name === 'reserva') {
    const consumo = 50;
    const f = (x) => x - consumo * (1 + 0.015 * 15);
    const df = (_) => 1;
    return { f, df };
  } else {
    const f = (x) => 1000 * x / (0.03 + x) - 400;
    const df = (x) => 1000 * 0.03 / Math.pow(0.03 + x, 2);
    return { f, df };
  }
}

function runRoots() {
  const funcName = document.getElementById('root-func').value;
  const method = document.getElementById('root-method').value;
  const a = +document.getElementById('root-a').value;
  const b = +document.getElementById('root-b').value;
  const tol = +document.getElementById('root-tol').value;
  const maxIter = +document.getElementById('root-maxiter').value;

  const { f, df } = getRootFunction(funcName);
  let result, methodName;

  try {
    if (method === 'biseccion') { result = biseccion(f, a, b, tol, maxIter); methodName = 'Bisección'; }
    else if (method === 'newton') { result = newtonRaphson(f, df, a, tol, maxIter); methodName = 'Newton-Raphson'; }
    else { result = secante(f, a, b, tol, maxIter); methodName = 'Secante'; }
  } catch(e) { alert('Error: ' + e.message); return; }

  if (result.root === null) { alert(result.msg || 'No se encontró raíz.'); return; }

  const convRate = result.iters.length > 2 ?
    (Math.log(result.iters[result.iters.length-1].error / result.iters[result.iters.length-2].error) /
     Math.log(result.iters[result.iters.length-2].error / (result.iters[result.iters.length-3]?.error || 1))).toFixed(2) : '-';

  document.getElementById('root-results').style.display = '';
  document.getElementById('root-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item highlight"><div class="ai-label">Raíz encontrada (umbral)</div><div class="ai-value">${result.root.toFixed(6)}</div></div>
      <div class="answer-item"><div class="ai-label">Iteraciones</div><div class="ai-value">${result.iters.length}</div></div>
      <div class="answer-item"><div class="ai-label">Error final</div><div class="ai-value">${result.iters[result.iters.length-1].error.toFixed(2e-9 < 1e-6 ? 10 : 8)}</div></div>
      <div class="answer-item"><div class="ai-label">Método</div><div class="ai-value">${methodName}</div></div>
    </div>`;

  // Chart de la función con raíz
  const xVals = Array.from({length:200}, (_,i) => a + (b-a)*i/199);
  const yVals = xVals.map(x => { try { return f(x); } catch { return null; } });

  getOrCreateChart('root-chart', mergeChartDefaults({
    type: 'line',
    data: {
      labels: xVals.map(v => v.toFixed(2)),
      datasets: [
        { label: 'f(x)', data: yVals.map((y, i) => ({x: xVals[i].toFixed(3), y})), borderColor: '#9b6dff', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
        { label: 'Raíz', data: [{ x: result.root.toFixed(3), y: 0 }], type: 'scatter', pointRadius: 8, backgroundColor: '#e8384f', borderColor: '#fff', borderWidth: 2 }
      ]
    },
    options: { plugins: { title: { display: true, text: `Función con Raíz — ${methodName}`, color: '#e8eaf0' } } }
  }));

  // Tabla iteraciones
  const iCols = method === 'biseccion' ? ['iter','a','b','c','fc','error'] :
                method === 'newton'    ? ['iter','x','fx','dfx','xNew','error'] :
                                         ['iter','x0','x1','x2','error'];
  const headerRow = `<tr>${iCols.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const dataRows = result.iters.slice(0, 15).map(it =>
    `<tr>${iCols.map(c => `<td>${it[c] !== undefined ? (typeof it[c] === 'number' ? it[c].toExponential ? it[c].toFixed(8) : it[c] : it[c]) : '-'}</td>`).join('')}</tr>`
  ).join('');
  document.getElementById('root-table-container').innerHTML = `
    <p style="font-size:0.78rem;color:#8b93a8;margin-bottom:0.4rem">Tabla de iteraciones (máx 15):</p>
    <div style="overflow-x:auto"><table class="results-table"><thead>${headerRow}</thead><tbody>${dataRows}</tbody></table></div>`;

  const interpretaciones = {
    gasto: `La familia llega al límite de su presupuesto en el <strong>día ${result.root.toFixed(1)}</strong> del mes. A partir de ese punto, los precios crecientes superan la capacidad de compra.`,
    reserva: `La tasa crítica de entrada es <strong>${result.root.toFixed(2)} unidades/día</strong>. Por debajo de este valor, el consumo supera el abastecimiento y la reserva se vacía.`,
    social: `El parámetro de influencia social crítico es <strong>${result.root.toFixed(4)}</strong>. Superado este umbral, el modelo predice masificación del descontento.`
  };
  document.getElementById('root-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    ${interpretaciones[funcName]}<br><br>
    <b>Robustez de métodos:</b> Bisección garantiza convergencia si f cambia de signo en [a,b], pero converge lentamente (orden 1). Newton-Raphson converge cuadráticamente (orden ~2) si la derivada no se anula. Secante no requiere derivada y converge con orden ~1.618.<br>
    <b>Iteraciones comparadas:</b> Bisección: ~${Math.ceil(Math.log2((b-a)/tol))} iters. Newton: ${result.iters.length} iters. La diferencia refleja el orden de convergencia.`;
}

// ============================================================
// ESCENARIO F — Rumores y sistemas mal condicionados
// ============================================================
function runRumor() {
  const nivel = document.getElementById('rumor-nivel').value;
  const zona = document.getElementById('rumor-zona').value;

  const perturbaciones = { bajo: 0.05, medio: 0.15, alto: 0.30, panico: 0.60 };
  const delta = perturbaciones[nivel];

  // Sistema base de distribución (3 zonas)
  const A = [[4,-1,0],[-1,4,-1],[0,-1,4]];
  const b0 = [90, 110, 100];
  const bPert = b0.map((v, i) => {
    if (zona === 'todas') return v * (1 + delta);
    if (zona === 'norte' && i === 0) return v * (1 + delta);
    if (zona === 'centro' && i === 1) return v * (1 + delta);
    if (zona === 'sur' && i === 2) return v * (1 + delta);
    return v;
  });

  const resBase = gaussSeidel(A, b0, 1e-6);
  const resPert = gaussSeidel(A, bPert, 1e-6);
  const kappa = conditionNumber(A);

  const cambios = resBase.x.map((v, i) => ((resPert.x[i] - v) / v * 100));
  const maxCambio = Math.max(...cambios.map(Math.abs));

  document.getElementById('rumor-results').style.display = '';
  document.getElementById('rumor-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item warning"><div class="ai-label">Número de condición κ(A)</div><div class="ai-value">${kappa.toFixed(4)}</div></div>
      <div class="answer-item"><div class="ai-label">Perturbación δb</div><div class="ai-value">+${(delta*100).toFixed(0)}%</div></div>
      <div class="answer-item ${maxCambio > 15 ? 'warning' : 'good'}"><div class="ai-label">Cambio máx en distribución</div><div class="ai-value">${maxCambio.toFixed(2)}%</div></div>
      <div class="answer-item"><div class="ai-label">Sistema</div><div class="ai-value">${kappa < 10 ? 'Bien condicionado' : kappa < 100 ? 'Moderado' : 'Mal condicionado'}</div></div>
    </div>`;

  getOrCreateChart('rumor-chart', mergeChartDefaults({
    type: 'bar',
    data: {
      labels: ['Zona Norte', 'Zona Centro', 'Zona Sur'],
      datasets: [
        { label: 'Sin rumor', data: resBase.x.map(v => +v.toFixed(2)), backgroundColor: 'rgba(74,159,255,0.6)' },
        { label: `Con rumor (${nivel})`, data: resPert.x.map(v => +v.toFixed(2)), backgroundColor: 'rgba(232,56,79,0.6)' }
      ]
    },
    options: { plugins: { title: { display: true, text: 'Impacto del Rumor en la Distribución', color: '#e8eaf0' } } }
  }));

  const tableRows = ['Norte', 'Centro', 'Sur'].map((z, i) =>
    `<tr><td>Zona ${z}</td><td>${resBase.x[i].toFixed(2)}</td><td>${resPert.x[i].toFixed(2)}</td><td>${bPert[i].toFixed(2)}</td><td class="${Math.abs(cambios[i]) > 10 ? 'warning' : ''}">${cambios[i] > 0 ? '+' : ''}${cambios[i].toFixed(2)}%</td></tr>`
  ).join('');
  document.getElementById('rumor-table-container').innerHTML = `
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Zona</th><th>Distribución base</th><th>Con rumor</th><th>Demanda perturbada</th><th>Cambio %</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

  document.getElementById('rumor-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿Qué pasa si la demanda aumenta un ${(delta*100).toFixed(0)}%?</b> La distribución cambia hasta un <strong>${maxCambio.toFixed(1)}%</strong> en la zona afectada.<br>
    <b>¿El sistema es estable?</b> El número de condición κ = ${kappa.toFixed(2)}. ${kappa < 10 ? 'Sistema bien condicionado: cambios pequeños generan cambios pequeños en la solución.' : kappa < 100 ? 'Sistema moderadamente condicionado.' : 'Sistema mal condicionado: pequeñas perturbaciones se amplifican.'}<br>
    <b>¿Cómo afecta el rumor?</b> Nivel "${nivel}" genera una perturbación del ${(delta*100).toFixed(0)}% en la demanda, que se traduce en reconfiguración de toda la red de distribución.<br>
    <b>¿Qué zona es más vulnerable?</b> La zona ${zona === 'todas' ? 'norte (mayor efecto en cadena)' : zona} se vuelve más vulnerable al colapsar el equilibrio de la red.`;
}

// ============================================================
// ESCENARIO G — Modelo social NMD
// ============================================================
function setPreset(name) {
  const presets = {
    'sin-mediadores': { 'soc-d0': 0, 'soc-k': 0, 'soc-c': 0, 'soc-a': 0.001, 'soc-b': 0.01 },
    'dialogo-efectivo': { 'soc-k': 0.15, 'soc-c': 0.008, 'soc-b': 0.08, 'soc-d0': 100 },
    'alta-conflictividad': { 'soc-a': 0.003, 'soc-b': 0.005, 'soc-c': 0.0005, 'soc-k': 0.02, 'soc-m0': 150 }
  };
  const p = presets[name];
  if (p) Object.entries(p).forEach(([id, v]) => { document.getElementById(id).value = v; });
}

function runSocial() {
  const N0 = +document.getElementById('soc-n0').value;
  const M0 = +document.getElementById('soc-m0').value;
  const D0 = +document.getElementById('soc-d0').value;
  const a  = +document.getElementById('soc-a').value;
  const b  = +document.getElementById('soc-b').value;
  const c  = +document.getElementById('soc-c').value;
  const k  = +document.getElementById('soc-k').value;
  const r  = +document.getElementById('soc-r').value;
  const dias = +document.getElementById('soc-dias').value;
  const method = document.getElementById('soc-method').value;
  const h = 0.5;
  const steps = Math.ceil(dias / h);

  // Sistema NMD
  const f = (t, y) => {
    const [N, M, D] = y;
    return [
      -a * N * M + b * D,
       a * N * M - c * M * D,
       k * M - r * D
    ];
  };

  const result = method === 'rk4' ? rk4(f, 0, [N0, M0, D0], h, steps) : heun(f, 0, [N0, M0, D0], h, steps);

  const everyN = Math.max(1, Math.floor(steps / 60));
  const labels = result.t.filter((_,i) => i % everyN === 0).map(v => v.toFixed(1));
  const dN = result.y.filter((_,i) => i % everyN === 0).map(y => +y[0].toFixed(1));
  const dM = result.y.filter((_,i) => i % everyN === 0).map(y => +y[1].toFixed(1));
  const dD = result.y.filter((_,i) => i % everyN === 0).map(y => +y[2].toFixed(1));

  const maxManif = Math.max(...result.y.map(y => y[1]));
  const maxIdx   = result.y.findIndex(y => y[1] === maxManif);
  const diaMax   = result.t[maxIdx];
  const finalM   = result.y[result.y.length-1][1];
  const tiendeEstabilidad = finalM < M0 * 1.5;

  document.getElementById('soc-results').style.display = '';
  document.getElementById('soc-answer').innerHTML = `
    <div class="answer-grid">
      <div class="answer-item ${maxManif > N0 * 0.5 ? 'warning' : 'good'}"><div class="ai-label">Pico de manifestantes</div><div class="ai-value">${maxManif.toFixed(0)} (día ${diaMax.toFixed(1)})</div></div>
      <div class="answer-item ${tiendeEstabilidad ? 'good' : 'warning'}"><div class="ai-label">Tendencia final</div><div class="ai-value">${tiendeEstabilidad ? 'Estabilización' : 'Masificación'}</div></div>
      <div class="answer-item"><div class="ai-label">Manifestantes finales</div><div class="ai-value">${finalM.toFixed(0)}</div></div>
      <div class="answer-item"><div class="ai-label">Método</div><div class="ai-value">${method.toUpperCase()}</div></div>
    </div>`;

  getOrCreateChart('soc-chart', mergeChartDefaults({
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'N(t) — Neutrales', data: dN, borderColor: '#4a9fff', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2 },
        { label: 'M(t) — Manifestantes', data: dM, borderColor: '#e8384f', backgroundColor: 'rgba(232,56,79,0.08)', fill: true, pointRadius: 0, borderWidth: 2 },
        { label: 'D(t) — Mediadores', data: dD, borderColor: '#2ec27e', backgroundColor: 'transparent', pointRadius: 0, borderWidth: 2, borderDash: [3,3] }
      ]
    },
    options: {
      plugins: { title: { display: true, text: `Dinámica Social NMD — ${method.toUpperCase()}`, color: '#e8eaf0' } },
      scales: {
        x: { title: { display: true, text: 'Días', color: '#8b93a8' } },
        y: { title: { display: true, text: 'Personas', color: '#8b93a8' } }
      }
    }
  }));

  // Tabla cada 5 días
  const step5d = Math.max(1, Math.floor(5/h));
  const tableRows = result.t
    .filter((_,i) => i % step5d === 0)
    .map((t, idx) => {
      const i = idx * step5d;
      const y = result.y[i];
      return y ? `<tr><td>${t.toFixed(1)}</td><td>${y[0].toFixed(0)}</td><td>${y[1].toFixed(0)}</td><td>${y[2].toFixed(0)}</td></tr>` : '';
    }).join('');
  document.getElementById('soc-table-container').innerHTML = `
    <div style="overflow-x:auto"><table class="results-table">
      <thead><tr><th>Día</th><th>N(t) Neutrales</th><th>M(t) Manifest.</th><th>D(t) Mediadores</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

  document.getElementById('soc-interpretation').innerHTML = `
    <strong>📋 Respuestas de la simulación:</strong><br><br>
    <b>¿El conflicto tiende a estabilizarse?</b> ${tiendeEstabilidad ? '✅ Sí. Los mediadores logran reducir el descontento a largo plazo.' : '⚠️ No. El conflicto se masifica sin contención efectiva.'}<br>
    <b>¿Los manifestantes aumentan?</b> Alcanzan un pico de <strong>${maxManif.toFixed(0)} personas</strong> en el día ${diaMax.toFixed(0)}, luego ${finalM < maxManif ? 'disminuyen' : 'se mantienen altos'}.<br>
    <b>¿Qué pasa si mejora el diálogo (c↑)?</b> Aumentar el parámetro c reduce manifestantes más rápidamente. Usa el preset "Diálogo efectivo".<br>
    <b>¿Qué pasa sin mediadores?</b> Sin D(t), el modelo se reduce a crecimiento logístico de M. Usa el preset "Sin mediadores".<br>
    <b>¿Qué parámetros masifican el conflicto?</b> Alta tasa de contagio (a↑) + baja respuesta institucional (k↓) + mediadores agotados (r↑) generan masificación. Usa "Alta conflictividad".`;
}
