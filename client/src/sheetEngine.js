export function colLetter(colIndex) {
  let n = colIndex + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function cellId(row, col) {
  return `${colLetter(col)}${row + 1}`;
}

function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const [, letters, digits] = m;
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: parseInt(digits, 10) - 1, col: col - 1 };
}

function expandRange(a, b) {
  const ra = parseRef(a);
  const rb = parseRef(b);
  if (!ra || !rb) return [];
  const refs = [];
  for (let r = Math.min(ra.row, rb.row); r <= Math.max(ra.row, rb.row); r++) {
    for (let c = Math.min(ra.col, rb.col); c <= Math.max(ra.col, rb.col); c++) {
      refs.push(cellId(r, c));
    }
  }
  return refs;
}

const FUNCS = {
  SUM: (vals) => vals.reduce((a, b) => a + b, 0),
  AVERAGE: (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0),
  MIN: (vals) => (vals.length ? Math.min(...vals) : 0),
  MAX: (vals) => (vals.length ? Math.max(...vals) : 0),
  COUNT: (vals) => vals.length,
};

export function evaluateCell(raw, cells, seen = new Set()) {
  if (raw == null || raw === '') return '';
  if (typeof raw !== 'string') return raw;
  if (!raw.startsWith('=')) {
    const n = Number(raw);
    return raw.trim() !== '' && !isNaN(n) ? n : raw;
  }

  let expr = raw.slice(1).trim();

  const funcMatch = /^([A-Z]+)\(([^)]*)\)$/.exec(expr);
  if (funcMatch) {
    const [, fnName, argsStr] = funcMatch;
    const fn = FUNCS[fnName.toUpperCase()];
    if (fn) {
      const parts = argsStr.split(',').map((p) => p.trim()).filter(Boolean);
      let refs = [];
      for (const part of parts) {
        if (part.includes(':')) {
          const [a, b] = part.split(':');
          refs.push(...expandRange(a, b));
        } else {
          refs.push(part);
        }
      }
      const vals = refs.map((r) => {
        const v = resolveRef(r, cells, seen);
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      });
      return fn(vals);
    }
  }

  // generic arithmetic expression with cell refs, e.g. =A1+B2*2
  try {
    const substituted = expr.replace(/[A-Z]+\d+/g, (ref) => {
      const v = resolveRef(ref, cells, seen);
      const n = Number(v);
      return isNaN(n) ? '0' : String(n);
    });
    if (!/^[0-9+\-*/().\s]*$/.test(substituted)) return '#ERROR';
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${substituted || 0})`)();
    return typeof result === 'number' && !isNaN(result) ? result : '#ERROR';
  } catch {
    return '#ERROR';
  }
}

function resolveRef(ref, cells, seen) {
  if (seen.has(ref)) return 0; // circular guard
  seen.add(ref);
  const raw = cells[ref]?.raw;
  return evaluateCell(raw, cells, seen);
}
