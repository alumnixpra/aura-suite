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

function resolveRef(ref, cells, seen) {
  if (seen.has(ref)) return 0; // circular guard
  seen.add(ref);
  const raw = cells[ref]?.raw;
  return evaluateCell(raw, cells, seen);
}

function splitArgs(str) {
  const args = [];
  let depth = 0;
  let current = '';
  let inQuotes = false;
  for (const ch of str) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === '(' && !inQuotes) depth++;
    if (ch === ')' && !inQuotes) depth--;
    if (ch === ',' && depth === 0 && !inQuotes) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') args.push(current.trim());
  return args;
}

function resolveArg(arg, cells, seen) {
  const trimmed = arg.trim();
  const quoted = /^"(.*)"$/.exec(trimmed);
  if (quoted) return quoted[1];
  if (trimmed.includes(':')) {
    const [a, b] = trimmed.split(':');
    return expandRange(a, b).map((r) => resolveRef(r, cells, seen));
  }
  if (/^[A-Z]+\d+$/.test(trimmed)) return resolveRef(trimmed, cells, seen);
  const n = Number(trimmed);
  if (!isNaN(n) && trimmed !== '') return n;
  return trimmed;
}

function toNumberList(values) {
  const flat = [];
  for (const v of values) {
    if (Array.isArray(v)) flat.push(...v.map((x) => Number(x)).filter((x) => !isNaN(x)));
    else {
      const n = Number(v);
      if (!isNaN(n)) flat.push(n);
    }
  }
  return flat;
}

const COMPARISON_RE = /^(.+?)(>=|<=|<>|=|>|<)(.+)$/;

function evalCondition(cond, cells, seen) {
  const m = COMPARISON_RE.exec(cond.trim());
  if (!m) return Boolean(resolveArg(cond, cells, seen));
  const [, leftRaw, op, rightRaw] = m;
  const left = resolveArg(leftRaw, cells, seen);
  const right = resolveArg(rightRaw, cells, seen);
  const ln = Number(left);
  const rn = Number(right);
  const useNum = !isNaN(ln) && !isNaN(rn);
  const l = useNum ? ln : left;
  const r = useNum ? rn : right;
  switch (op) {
    case '>': return l > r;
    case '<': return l < r;
    case '>=': return l >= r;
    case '<=': return l <= r;
    case '<>': return l !== r;
    case '=': return l === r;
    default: return false;
  }
}

const FUNCS = {
  SUM: (args, cells, seen) => toNumberList(args.map((a) => resolveArg(a, cells, seen))).reduce((a, b) => a + b, 0),
  AVERAGE: (args, cells, seen) => {
    const nums = toNumberList(args.map((a) => resolveArg(a, cells, seen)));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  MIN: (args, cells, seen) => {
    const nums = toNumberList(args.map((a) => resolveArg(a, cells, seen)));
    return nums.length ? Math.min(...nums) : 0;
  },
  MAX: (args, cells, seen) => {
    const nums = toNumberList(args.map((a) => resolveArg(a, cells, seen)));
    return nums.length ? Math.max(...nums) : 0;
  },
  COUNT: (args, cells, seen) => toNumberList(args.map((a) => resolveArg(a, cells, seen))).length,
  ABS: (args, cells, seen) => Math.abs(Number(resolveArg(args[0], cells, seen)) || 0),
  ROUND: (args, cells, seen) => {
    const val = Number(resolveArg(args[0], cells, seen)) || 0;
    const decimals = args[1] !== undefined ? Number(resolveArg(args[1], cells, seen)) || 0 : 0;
    const factor = 10 ** decimals;
    return Math.round(val * factor) / factor;
  },
  POWER: (args, cells, seen) => {
    const base = Number(resolveArg(args[0], cells, seen)) || 0;
    const exp = Number(resolveArg(args[1], cells, seen)) || 0;
    return base ** exp;
  },
  CONCATENATE: (args, cells, seen) => args.map((a) => String(resolveArg(a, cells, seen))).join(''),
  TODAY: () => new Date().toLocaleDateString(),
  IF: (args, cells, seen) => {
    const condTrue = evalCondition(args[0], cells, seen);
    const branch = condTrue ? args[1] : args[2];
    return branch !== undefined ? resolveArg(branch, cells, seen) : '';
  },
};

export function evaluateCell(raw, cells, seen = new Set()) {
  if (raw == null || raw === '') return '';
  if (typeof raw !== 'string') return raw;
  if (!raw.startsWith('=')) {
    const n = Number(raw);
    return raw.trim() !== '' && !isNaN(n) ? n : raw;
  }

  const expr = raw.slice(1).trim();

  const funcMatch = /^([A-Z]+)\((.*)\)$/.exec(expr);
  if (funcMatch) {
    const [, fnName, argsStr] = funcMatch;
    const fn = FUNCS[fnName.toUpperCase()];
    if (fn) {
      const args = splitArgs(argsStr);
      try {
        return fn(args, cells, seen);
      } catch {
        return '#ERROR';
      }
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
