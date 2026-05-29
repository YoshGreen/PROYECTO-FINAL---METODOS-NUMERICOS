// ============================================================
// methods.js — Implementaciones de todos los métodos numéricos
// ============================================================

// ============ SISTEMAS DE ECUACIONES LINEALES ============

function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  return Array.from({length: n}, (_, i) =>
    Array.from({length: m}, (_, j) =>
      A[i].reduce((s, _, l) => s + A[i][l] * B[l][j], 0)));
}

function vecSub(a, b) { return a.map((v, i) => v - b[i]); }
function vecNorm(v) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)); }
function vecDot(a, b) { return a.reduce((s, x, i) => s + x * b[i], 0); }
function matVec(A, x) { return A.map(row => row.reduce((s, v, j) => s + v * x[j], 0)); }

function copyMatrix(A) { return A.map(r => [...r]); }
function copyVec(v) { return [...v]; }

// --- Gauss-Seidel ---
function gaussSeidel(A, b, tol = 1e-6, maxIter = 100) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const iters = [];
  for (let iter = 0; iter < maxIter; iter++) {
    const xOld = copyVec(x);
    for (let i = 0; i < n; i++) {
      let sigma = b[i];
      for (let j = 0; j < n; j++) { if (j !== i) sigma -= A[i][j] * x[j]; }
      x[i] = sigma / A[i][i];
    }
    const err = vecNorm(vecSub(x, xOld));
    iters.push({ iter: iter + 1, x: copyVec(x), error: err });
    if (err < tol) break;
  }
  return { x, iters };
}

// --- Jacobi ---
function jacobi(A, b, tol = 1e-6, maxIter = 100) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const iters = [];
  for (let iter = 0; iter < maxIter; iter++) {
    const xNew = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sigma = b[i];
      for (let j = 0; j < n; j++) { if (j !== i) sigma -= A[i][j] * x[j]; }
      xNew[i] = sigma / A[i][i];
    }
    const err = vecNorm(vecSub(xNew, x));
    iters.push({ iter: iter + 1, x: copyVec(xNew), error: err });
    x = xNew;
    if (err < tol) break;
  }
  return { x, iters };
}

// --- SOR ---
function sor(A, b, omega = 1.25, tol = 1e-6, maxIter = 100) {
  const n = A.length;
  let x = new Array(n).fill(0);
  const iters = [];
  for (let iter = 0; iter < maxIter; iter++) {
    const xOld = copyVec(x);
    for (let i = 0; i < n; i++) {
      let sigma = b[i];
      for (let j = 0; j < n; j++) { if (j !== i) sigma -= A[i][j] * x[j]; }
      x[i] = (1 - omega) * x[i] + omega * sigma / A[i][i];
    }
    const err = vecNorm(vecSub(x, xOld));
    iters.push({ iter: iter + 1, x: copyVec(x), error: err });
    if (err < tol) break;
  }
  return { x, iters };
}

// --- LU Descomposición ---
function luDecomp(Ain, bin) {
  const n = Ain.length;
  const A = copyMatrix(Ain);
  const L = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
  const U = copyMatrix(A);
  for (let k = 0; k < n; k++) {
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) U[i][j] -= L[i][k] * U[k][j];
    }
  }
  // Forward substitution Ly = b
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    y[i] = bin[i] - L[i].slice(0, i).reduce((s, v, j) => s + v * y[j], 0);
  }
  // Back substitution Ux = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = (y[i] - U[i].slice(i + 1).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) / U[i][i];
  }
  return { x, L, U, iters: [{ iter: 1, x: copyVec(x), error: 0 }] };
}

// --- Gradiente Conjugado ---
function conjugadoGradiente(A, b, tol = 1e-6, maxIter = 100) {
  const n = A.length;
  let x = new Array(n).fill(0);
  let r = vecSub(b, matVec(A, x));
  let p = copyVec(r);
  const iters = [];
  for (let iter = 0; iter < maxIter; iter++) {
    const Ap = matVec(A, p);
    const alpha = vecDot(r, r) / vecDot(p, Ap);
    const xNew = x.map((v, i) => v + alpha * p[i]);
    const rNew = r.map((v, i) => v - alpha * Ap[i]);
    const err = vecNorm(rNew);
    iters.push({ iter: iter + 1, x: copyVec(xNew), error: err });
    if (err < tol) break;
    const beta = vecDot(rNew, rNew) / vecDot(r, r);
    p = rNew.map((v, i) => v + beta * p[i]);
    r = rNew; x = xNew;
  }
  return { x, iters };
}

// ============ EDOs ============

// --- Euler ---
function euler(f, t0, y0, h, steps) {
  const t = [t0], y = [copyVec ? (Array.isArray(y0) ? [...y0] : y0) : y0];
  for (let i = 0; i < steps; i++) {
    const yn = Array.isArray(y[i]) ? y[i] : [y[i]];
    const fn = f(t[i], yn);
    const yNew = yn.map((v, j) => v + h * fn[j]);
    t.push(t[i] + h);
    y.push(yNew);
  }
  return { t, y };
}

// --- Heun ---
function heun(f, t0, y0, h, steps) {
  const t = [t0], y = [[...y0]];
  for (let i = 0; i < steps; i++) {
    const yn = y[i], tn = t[i];
    const k1 = f(tn, yn);
    const yPred = yn.map((v, j) => v + h * k1[j]);
    const k2 = f(tn + h, yPred);
    const yNew = yn.map((v, j) => v + (h / 2) * (k1[j] + k2[j]));
    t.push(tn + h); y.push(yNew);
  }
  return { t, y };
}

// --- RK4 ---
function rk4(f, t0, y0, h, steps) {
  const t = [t0], y = [[...y0]];
  for (let i = 0; i < steps; i++) {
    const yn = y[i], tn = t[i];
    const k1 = f(tn, yn);
    const k2 = f(tn + h/2, yn.map((v, j) => v + h/2 * k1[j]));
    const k3 = f(tn + h/2, yn.map((v, j) => v + h/2 * k2[j]));
    const k4 = f(tn + h,   yn.map((v, j) => v + h   * k3[j]));
    const yNew = yn.map((v, j) => v + (h/6)*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    t.push(tn + h); y.push(yNew);
  }
  return { t, y };
}

// ============ INTERPOLACIÓN ============

// --- Lagrange ---
function lagrange(xs, ys, x) {
  let result = 0;
  for (let i = 0; i < xs.length; i++) {
    let term = ys[i];
    for (let j = 0; j < xs.length; j++) {
      if (i !== j) term *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    result += term;
  }
  return result;
}

function lagrangeCurve(xs, ys, pts = 100) {
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const step = (xMax - xMin) / pts;
  const xc = [], yc = [];
  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    xc.push(+x.toFixed(3));
    yc.push(lagrange(xs, ys, x));
  }
  return { xc, yc };
}

// --- Newton diferencias divididas ---
function newtonDivDiff(xs, ys) {
  const n = xs.length;
  const table = Array.from({length:n}, (_, i) => [...ys].slice(0, n).map((v, j) => j === i ? ys[j] : 0));
  // Fill divided differences
  const dd = [ys.slice()];
  for (let order = 1; order < n; order++) {
    const row = [];
    for (let i = 0; i < n - order; i++) {
      row.push((dd[order-1][i+1] - dd[order-1][i]) / (xs[i+order] - xs[i]));
    }
    dd.push(row);
  }
  const coeffs = dd.map(r => r[0]);
  function evalNewton(x) {
    let result = coeffs[0], term = 1;
    for (let i = 1; i < n; i++) {
      term *= (x - xs[i-1]);
      result += coeffs[i] * term;
    }
    return result;
  }
  return { coeffs, evalNewton, dd };
}

function newtonCurve(xs, ys, pts = 100) {
  const { evalNewton } = newtonDivDiff(xs, ys);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const step = (xMax - xMin) / pts;
  const xc = [], yc = [];
  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    xc.push(+x.toFixed(3));
    yc.push(evalNewton(x));
  }
  return { xc, yc, evalNewton };
}

// --- Splines cúbicos (natural) ---
function cubicSpline(xs, ys) {
  const n = xs.length - 1;
  const h = xs.slice(0, n).map((x, i) => xs[i+1] - x);
  // Thomas algorithm for M
  const alpha = Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    alpha[i] = (3/h[i])*(ys[i+1]-ys[i]) - (3/h[i-1])*(ys[i]-ys[i-1]);
  }
  const l = [1], mu = [0], z = [0];
  for (let i = 1; i < n; i++) {
    l.push(2*(xs[i+1]-xs[i-1]) - h[i-1]*mu[i-1]);
    mu.push(h[i]/l[i]);
    z.push((alpha[i]-h[i-1]*z[i-1])/l[i]);
  }
  l.push(1); z.push(0);
  const c = Array(n+1).fill(0), b = Array(n).fill(0), d = Array(n).fill(0);
  for (let j = n-1; j >= 0; j--) {
    c[j] = z[j] - mu[j]*c[j+1];
    b[j] = (ys[j+1]-ys[j])/h[j] - h[j]*(c[j+1]+2*c[j])/3;
    d[j] = (c[j+1]-c[j])/(3*h[j]);
  }
  function evalSpline(x) {
    let i = 0;
    for (let k = 0; k < n-1; k++) { if (x >= xs[k]) i = k; }
    const dx = x - xs[i];
    return ys[i] + b[i]*dx + c[i]*dx*dx + d[i]*dx*dx*dx;
  }
  return { evalSpline, b, c, d };
}

function splineCurve(xs, ys, pts = 100) {
  const { evalSpline } = cubicSpline(xs, ys);
  const xMin = xs[0], xMax = xs[xs.length-1];
  const step = (xMax - xMin) / pts;
  const xc = [], yc = [];
  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    xc.push(+x.toFixed(3));
    yc.push(evalSpline(x));
  }
  return { xc, yc, evalSpline };
}

// ============ INTEGRACIÓN NUMÉRICA ============

function trapecio(f, a, b, n) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += 2 * f(a + i * h);
  return (h / 2) * sum;
}

function simpson13(f, a, b, n) {
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  }
  return (h / 3) * sum;
}

function simpson38(f, a, b, n) {
  if (n % 3 !== 0) n += 3 - (n % 3);
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    sum += (i % 3 === 0 ? 2 : 3) * f(a + i * h);
  }
  return (3 * h / 8) * sum;
}

// ============ RAÍCES DE ECUACIONES ============

function biseccion(f, a, b, tol = 1e-6, maxIter = 50) {
  const iters = [];
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return { root: null, iters, msg: 'No hay cambio de signo en [a,b]' };
  let c;
  for (let i = 0; i < maxIter; i++) {
    c = (a + b) / 2;
    const fc = f(c);
    iters.push({ iter: i+1, a: +a.toFixed(6), b: +b.toFixed(6), c: +c.toFixed(6), fc: +fc.toFixed(8), error: +(b-a).toFixed(8) });
    if (Math.abs(fc) < tol || (b - a) / 2 < tol) break;
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: c, iters };
}

function newtonRaphson(f, df, x0, tol = 1e-6, maxIter = 50) {
  let x = x0;
  const iters = [];
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x), dfx = df(x);
    const xNew = x - fx / dfx;
    const err = Math.abs(xNew - x);
    iters.push({ iter: i+1, x: +x.toFixed(8), fx: +fx.toFixed(8), dfx: +dfx.toFixed(8), xNew: +xNew.toFixed(8), error: +err.toFixed(10) });
    x = xNew;
    if (err < tol) break;
  }
  return { root: x, iters };
}

function secante(f, x0, x1, tol = 1e-6, maxIter = 50) {
  const iters = [];
  for (let i = 0; i < maxIter; i++) {
    const f0 = f(x0), f1 = f(x1);
    const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
    const err = Math.abs(x2 - x1);
    iters.push({ iter: i+1, x0: +x0.toFixed(8), x1: +x1.toFixed(8), x2: +x2.toFixed(8), error: +err.toFixed(10) });
    x0 = x1; x1 = x2;
    if (err < tol) break;
  }
  return { root: x1, iters };
}

// ============ NÚMERO DE CONDICIÓN ============
function conditionNumber(A) {
  const n = A.length;
  // Estimación por norma 1 (suma de columnas)
  const norm1 = (M) => Math.max(...Array.from({length:n}, (_,j) =>
    M.reduce((s, row) => s + Math.abs(row[j]), 0)));
  // Invertir por eliminación gaussiana
  const aug = A.map((row, i) => [...row, ...Array(n).fill(0).map((_,j) => j===i?1:0)]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col+1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) return Infinity;
    for (let r = 0; r < n; r++) {
      if (r !== col) {
        const factor = aug[r][col] / pivot;
        for (let c = col; c < 2*n; c++) aug[r][c] -= factor * aug[col][c];
      }
    }
    for (let c = col; c < 2*n; c++) aug[col][c] /= pivot;
  }
  const Ainv = aug.map(row => row.slice(n));
  return norm1(A) * norm1(Ainv);
}
