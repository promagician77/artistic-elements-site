// Feet-and-inch dimension text as US interior drawings write it: 2'-6", 2'-6 1/2", 0'-4 3/4", 30", 30 1/2", 10'-0".
// Values are kept in sixteenths of an inch so sums are exact.

const FRACTION = /^(\d+)\/(\d+)$/;

function parseInches(s) {
  // "6", "6 1/2", "1/2", "6.5"
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 2) return null;
  let total = 0;
  for (const p of parts) {
    const f = FRACTION.exec(p);
    if (f) {
      const den = Number(f[2]);
      if (!den || 16 % den !== 0 || Number(f[1]) >= den) return null;
      total += (Number(f[1]) * 16) / den;
    } else if (/^\d+(\.\d+)?$/.test(p)) {
      if (parts.length === 2 && p !== parts[0]) return null;
      total += Number(p) * 16;
    } else return null;
  }
  return total;
}

// Returns sixteenths of an inch, or null when the text is not a dimension.
export function parseDim(text) {
  const t = String(text).trim().replace(/[′’]/g, "'").replace(/[″”]/g, '"');
  let m = /^(\d+)'\s*-?\s*(.*?)"?$/.exec(t);
  if (m && t.includes("'")) {
    const feet = Number(m[1]) * 12 * 16;
    if (m[2] === '') return t.endsWith("'") ? feet : null;
    const inch = parseInches(m[2]);
    if (inch == null || inch >= 12 * 16) return null;
    return feet + inch;
  }
  m = /^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)"$/.exec(t);
  if (m) return parseInches(m[1]);
  return null;
}

export const isDim = (text) => parseDim(text) != null;

// Sixteenths -> 2'-6 1/2"
export function formatDim(sixteenths, { feet = true } = {}) {
  const neg = sixteenths < 0;
  let s = Math.round(Math.abs(sixteenths));
  const ft = feet ? Math.floor(s / 192) : 0;
  s -= ft * 192;
  const inch = Math.floor(s / 16);
  let frac = s % 16;
  let den = 16;
  while (frac && frac % 2 === 0) { frac /= 2; den /= 2; }
  const inchText = frac ? (inch || feet ? `${inch} ${frac}/${den}` : `${frac}/${den}`) : String(inch);
  return (neg ? '-' : '') + (feet ? `${ft}'-${inchText}"` : `${inchText}"`);
}

export const inches = (n) => Math.round(n * 16);
