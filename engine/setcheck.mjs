// Reads positioned text from each sheet of an interior drawing set and checks it the way a CAD lead would
// before the set goes out: sheet IDs, the sheet index, every callout, drawing numbers, sheet types, revisions,
// and dimension strings that must add up to their overall.
import { parseDim, formatDim } from './feetinch.mjs';

export const DEFAULT_RULES = {
  sheetPattern: '^I-\\d{3}$',                 // US National CAD Standard style: discipline I, type digit, sequence
  sheetExample: 'I-101',
  sheetLike: '^[A-Z]{1,2}-?\\d{1,4}[A-Z]?$',  // anything that looks like a sheet number
  titleBlockWidth: 190,                       // points from the right edge of the sheet
  labels: { sheet: 'SHEET', title: 'SHEET TITLE', rev: 'REV', index: 'SHEET INDEX' },
  minDrawingTitleSize: 9,                     // drawing-title numbers are larger than marker numbers
  // which sheet-type digits each kind of drawing may sit on (0 general, 1 plans, 2 elevations, 3 sections,
  // 4 large-scale views, 5 details, 6 schedules)
  sheetTypes: [
    { word: 'DETAIL', types: [5] },
    { word: 'SCHEDULE', types: [6] },
    { word: 'SECTION', types: [3, 4] },
    { word: 'ELEVATION', types: [2, 4] },
    { word: 'REFLECTED CEILING', types: [1] },
    { word: 'PLAN', types: [1, 4] },
  ],
  mustBeReferenced: [2, 3, 4, 5],              // drawings on these sheet types need at least one callout
  skipDimsOnTypes: [0, 6],                     // cover sheets and schedules hold sizes in tables, not dimension strings
  fileNamePattern: '^[A-Z]{2}-\\d{2}_I-Set_(SD|DD|CD)_R(\\d+)\\.pdf$',
  fileNameExample: 'TS-01_I-Set_CD_R2.pdf',
};

export const MESSAGES = {
  'missing-sheet-id': ['error', 'No sheet number found in the title block'],
  'sheet-id-format': ['error', 'Sheet number does not follow the sheet-number standard'],
  'duplicate-sheet': ['error', 'Two sheets carry the same sheet number'],
  'callout-missing-sheet': ['error', 'Callout points to a sheet that is not in the set'],
  'callout-missing-drawing': ['error', 'Callout points to a drawing number that is not on that sheet'],
  'duplicate-drawing-number': ['error', 'Two drawings on one sheet share a number'],
  'index-missing-sheet': ['error', 'The sheet index lists a sheet that is not in the set'],
  'sheet-not-in-index': ['error', 'A sheet in the set is missing from the sheet index'],
  'index-title-mismatch': ['error', 'The sheet index and the title block disagree on the sheet title'],
  'index-rev-mismatch': ['error', 'The sheet index and the title block disagree on the revision'],
  'dims-dont-add-up': ['error', 'A dimension string does not add up to its overall'],
  'orphan-drawing': ['warning', 'A drawing is not called out from anywhere in the set'],
  'wrong-sheet-type': ['warning', 'A drawing sits on a sheet of a different type'],
  'no-index': ['warning', 'No sheet index found'],
  'file-name': ['error', 'The file name does not follow the naming standard'],
  'file-name-rev': ['error', 'The revision in the file name is not the latest revision in the set'],
};

const norm = (s) => String(s).toUpperCase().replace(/&/g, 'AND').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const isDigits = (s) => /^\d{1,2}$/.test(s);
const horizontal = (it) => Math.abs(it.angle) <= 5;
const vertical = (it) => Math.abs(it.angle - 90) <= 5;

export function sheetType(id) {
  const m = /^[A-Z]{1,2}-?(\d)/.exec(id || '');
  return m ? Number(m[1]) : null;
}

function inTitleBlock(page, it, rules) {
  return it.x >= page.width - rules.titleBlockWidth;
}

// Value written under a label in the title block (left-aligned, within 30 pt below it).
function under(items, label, maxDrop = 30) {
  return items
    .filter((it) => it !== label && Math.abs(it.x - label.x) <= 6 && it.y < label.y && label.y - it.y <= maxDrop)
    .sort((a, b) => b.y - a.y);
}

export function readTitleBlock(page, rules = DEFAULT_RULES) {
  const tb = page.items.filter((it) => inTitleBlock(page, it, rules));
  const label = (t) => tb.find((it) => it.str === t);
  const out = { id: null, title: null, rev: null, idItem: null };
  const L = rules.labels;
  const ls = label(L.sheet);
  if (ls) {
    const v = under(tb, ls)[0];
    if (v) { out.id = v.str; out.idItem = v; }
  }
  if (!out.id) {
    // no label: take the largest sheet-like text in the title block
    const like = new RegExp(rules.sheetLike);
    const cand = tb.filter((it) => like.test(it.str)).sort((a, b) => b.size - a.size)[0];
    if (cand) { out.id = cand.str; out.idItem = cand; }
  }
  const lt = label(L.title);
  if (lt) {
    const lines = [];
    let prev = lt;
    for (const it of under(tb, lt, 200)) {
      if (prev.y - it.y > 14) break;
      lines.push(it.str);
      prev = it;
    }
    out.title = lines.join(' ') || null;
  }
  const lr = label(L.rev);
  if (lr) {
    const v = under(tb, lr)[0];
    if (v) out.rev = v.str;
  }
  return out;
}

export function readDrawings(page, rules = DEFAULT_RULES) {
  const items = page.items.filter((it) => !inTitleBlock(page, it, rules) && horizontal(it));
  const out = [];
  for (const num of items) {
    if (!isDigits(num.str) || num.size < rules.minDrawingTitleSize) continue;
    const title = items
      .filter((t) => t !== num && /[A-Z]{2}/.test(t.str) && t.str === t.str.toUpperCase() && Math.abs(t.y - num.y) <= 1.5)
      .map((t) => ({ t, gap: t.x - (num.x + num.w) }))
      .filter((o) => o.gap >= 4 && o.gap <= 40)
      .sort((a, b) => a.gap - b.gap)[0];
    if (title && title.t.size >= rules.minDrawingTitleSize) out.push({ n: Number(num.str), title: title.t.str, x: num.x, y: num.y, item: num });
  }
  return out;
}

export function readCallouts(page, rules = DEFAULT_RULES, drawingItems = new Set()) {
  const like = new RegExp(rules.sheetLike);
  const items = page.items.filter((it) => !inTitleBlock(page, it, rules) && horizontal(it));
  const sheets = items.filter((it) => like.test(it.str));
  const out = [];
  for (const num of items) {
    if (!isDigits(num.str) || drawingItems.has(num)) continue;
    const s = sheets.find((sh) => Math.abs(sh.cx - num.cx) <= 6 && num.y - sh.y >= 3 && num.y - sh.y <= 16);
    if (s) out.push({ n: Number(num.str), sheet: s.str, x: num.cx, y: num.cy, item: num });
  }
  return out;
}

export function readIndex(page, rules = DEFAULT_RULES) {
  const head = page.items.find((it) => norm(it.str) === norm(rules.labels.index));
  if (!head) return null;
  const like = new RegExp(rules.sheetLike);
  const below = page.items.filter((it) => it.y < head.y && head.y - it.y < 700 && it.x >= head.x - 20 && !inTitleBlock(page, it, rules) && horizontal(it));
  const lineOf = (idItem) => below.filter((it) => it !== idItem && Math.abs(it.y - idItem.y) <= 1.5 && it.x > idItem.x && it.x - idItem.x < 330).sort((a, b) => a.x - b.x);
  // a row is a sheet number with a title to its right; long indexes wrap into more than one column
  const rows = below
    .filter((it) => like.test(it.str) && lineOf(it).some((o) => /[A-Z]{2}/.test(o.str)))
    .sort((a, b) => a.x - b.x || b.y - a.y)
    .map((idItem) => {
      const line = lineOf(idItem).filter((it, i, arr) => !(like.test(it.str) && i > 0));
      const last = line[line.length - 1];
      const rev = last && /^\d{1,3}$/.test(last.str) ? last.str : null;
      const title = line.filter((it) => it !== (rev ? last : null)).map((it) => it.str).join(' ');
      return { id: idItem.str, title, rev, item: idItem };
    });
  return { rows, at: head };
}

// Which drawing a piece of text belongs to: drawing titles sit under their drawing, at its lower left.
function regionOf(it, drawings) {
  let best = null;
  for (const d of drawings) {
    if (d.y > it.cy + 2 || d.x - 30 > it.cx) continue;
    if (!best || d.y > best.y + 1 || (Math.abs(d.y - best.y) <= 1 && d.x > best.x)) best = d;
  }
  return best;
}

function groupLines(items, key, tol = 1.5) {
  const lines = [];
  for (const it of [...items].sort((a, b) => key(a) - key(b))) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(key(it) - last.k) <= tol) last.items.push(it);
    else lines.push({ k: key(it), items: [it] });
  }
  return lines;
}

// Dimension strings: a line of two or more dimensions, and the single overall just outside it.
export function checkDims(page, drawings, rules = DEFAULT_RULES) {
  const dims = page.items
    .filter((it) => !inTitleBlock(page, it, rules))
    .map((it) => ({ it, v: parseDim(it.str) }))
    .filter((o) => o.v != null && (horizontal(o.it) || vertical(o.it)));
  const findings = [];
  const strings = [];
  const regions = new Map();
  for (const o of dims) {
    const r = regionOf(o.it, drawings);
    const key = r ? `${r.n}@${r.x},${r.y}` : 'none';
    if (!regions.has(key)) regions.set(key, { drawing: r, dims: [] });
    regions.get(key).dims.push(o);
  }
  for (const { drawing, dims: ds } of regions.values()) {
    for (const [orient, along, across] of [['h', (o) => o.it.cx, (o) => o.it.cy], ['v', (o) => o.it.cy, (o) => o.it.cx]]) {
      const set = ds.filter((o) => (orient === 'h' ? horizontal(o.it) : vertical(o.it)));
      const lines = groupLines(set, across);
      const chains = lines.filter((l) => l.items.length >= 2);
      const singles = lines.filter((l) => l.items.length === 1);
      for (const ch of chains) {
        const lo = Math.min(...ch.items.map(along));
        const hi = Math.max(...ch.items.map(along));
        // text sits mid-segment, so the string reaches about one segment past its outer texts
        const reach = Math.max(30, (hi - lo) / (ch.items.length - 1));
        const overall = singles
          .map((l) => ({ o: l.items[0], d: Math.abs(l.k - ch.k) }))
          .filter(({ o, d }) => d >= 6 && d <= 45 && along(o) >= lo - reach && along(o) <= hi + reach)
          .sort((a, b) => a.d - b.d)[0];
        if (!overall) continue;
        const sum = ch.items.reduce((acc, o) => acc + o.v, 0);
        const ok = sum === overall.o.v;
        const feet = /'/.test(overall.o.it.str);
        const parts = [...ch.items].sort((a, b) => along(a) - along(b)).map((o) => o.it.str);
        strings.push({ drawing: drawing && drawing.n, orient, parts, overall: overall.o.it.str, ok });
        if (!ok) {
          findings.push({
            code: 'dims-dont-add-up', drawing: drawing && drawing.n, at: { x: overall.o.it.cx, y: overall.o.it.cy },
            detail: `${parts.join(' + ')} = ${formatDim(sum, { feet })}, but the overall reads ${overall.o.it.str}`,
          });
        }
      }
    }
  }
  return { findings, strings };
}

export function readSheet(page, rules = DEFAULT_RULES) {
  const tb = readTitleBlock(page, rules);
  const drawings = readDrawings(page, rules);
  const callouts = readCallouts(page, rules, new Set(drawings.map((d) => d.item)));
  for (const c of callouts) c.from = regionOf(c.item, drawings)?.n ?? null;
  const index = readIndex(page, rules);
  return { page: page.n, ...tb, drawings, callouts, index };
}

export function checkSet(pages, rules = DEFAULT_RULES) {
  const R = { ...DEFAULT_RULES, ...rules, labels: { ...DEFAULT_RULES.labels, ...(rules.labels || {}) } };
  const pattern = new RegExp(R.sheetPattern);
  const sheets = pages.map((p) => readSheet(p, R));
  const issues = [];
  const add = (code, sheet, page, at, detail, extra = {}) => issues.push({ code, level: MESSAGES[code][0], sheet, page, at, detail, ...extra });

  // sheet numbers
  const byId = new Map();
  for (const s of sheets) {
    if (!s.id) { add('missing-sheet-id', null, s.page, null, `Page ${s.page}`); continue; }
    if (!pattern.test(s.id)) add('sheet-id-format', s.id, s.page, pt(s.idItem), `"${s.id}" should look like ${R.sheetExample}`);
    if (byId.has(s.id)) add('duplicate-sheet', s.id, s.page, pt(s.idItem), `Pages ${byId.get(s.id).page} and ${s.page}`);
    else byId.set(s.id, s);
  }

  // drawings on each sheet
  const drawingKeys = new Set();
  for (const s of sheets) {
    const seen = new Map();
    for (const d of s.drawings) {
      if (seen.has(d.n)) add('duplicate-drawing-number', s.id, s.page, pt(d.item), `Drawing ${d.n}: "${seen.get(d.n).title}" and "${d.title}"`);
      else seen.set(d.n, d);
      drawingKeys.add(`${s.id}/${d.n}`);
      const t = sheetType(s.id);
      const rule = R.sheetTypes.find((x) => norm(d.title).includes(x.word));
      if (rule && t != null && !rule.types.includes(t)) {
        add('wrong-sheet-type', s.id, s.page, pt(d.item), `"${d.title}" on a type-${t} sheet; expected type ${rule.types.join(' or ')}`);
      }
    }
  }

  // callouts
  const referenced = new Set();
  for (const s of sheets) {
    for (const c of s.callouts) {
      const key = `${c.sheet}/${c.n}`;
      referenced.add(key);
      if (!byId.has(c.sheet)) add('callout-missing-sheet', s.id, s.page, { x: c.x, y: c.y }, `Callout ${c.n}/${c.sheet}${c.from != null ? ` in drawing ${c.from}` : ''}: there is no sheet ${c.sheet}`);
      else if (!drawingKeys.has(key)) add('callout-missing-drawing', s.id, s.page, { x: c.x, y: c.y }, `Callout ${c.n}/${c.sheet}${c.from != null ? ` in drawing ${c.from}` : ''}: ${c.sheet} has drawings ${byId.get(c.sheet).drawings.map((d) => d.n).join(', ') || 'none'}`);
    }
  }
  for (const s of sheets) {
    if (!R.mustBeReferenced.includes(sheetType(s.id))) continue;
    for (const d of s.drawings) {
      if (!referenced.has(`${s.id}/${d.n}`)) add('orphan-drawing', s.id, s.page, pt(d.item), `Drawing ${d.n}, "${d.title}", has no callout pointing to it`);
    }
  }

  // sheet index
  const idxSheet = sheets.find((s) => s.index && s.index.rows.length);
  if (!idxSheet) add('no-index', null, null, null, `No "${R.labels.index}" found`);
  else {
    const rows = new Map(idxSheet.index.rows.map((r) => [r.id, r]));
    for (const r of idxSheet.index.rows) {
      const s = byId.get(r.id);
      if (!s) { add('index-missing-sheet', r.id, idxSheet.page, pt(r.item), `Index row "${r.id} ${r.title}"`); continue; }
      if (s.title && norm(r.title) !== norm(s.title)) add('index-title-mismatch', r.id, idxSheet.page, pt(r.item), `Index: "${r.title}"; title block: "${s.title}"`, { otherPage: s.page });
      if (s.rev != null && r.rev != null && String(r.rev) !== String(s.rev)) add('index-rev-mismatch', r.id, s.page, pt(s.idItem), `Index: revision ${r.rev}; title block: revision ${s.rev}`);
    }
    for (const s of sheets) if (s.id && !rows.has(s.id)) add('sheet-not-in-index', s.id, s.page, pt(s.idItem), `${s.id} "${s.title || ''}" is not listed`);
  }

  // dimension strings
  const dimStrings = [];
  pages.forEach((p, i) => {
    const s = sheets[i];
    if (R.skipDimsOnTypes.includes(sheetType(s.id))) return;
    const { findings, strings } = checkDims(p, s.drawings, R);
    for (const f of findings) add(f.code, s.id, s.page, f.at, `Drawing ${f.drawing ?? '?'}: ${f.detail}`);
    for (const st of strings) dimStrings.push({ sheet: s.id, ...st });
  });

  const order = Object.keys(MESSAGES);
  issues.sort((a, b) => (a.page ?? 0) - (b.page ?? 0) || order.indexOf(a.code) - order.indexOf(b.code));
  const revs = sheets.map((s) => Number(s.rev)).filter((n) => Number.isFinite(n));
  return {
    sheets: sheets.map((s) => ({ page: s.page, id: s.id, title: s.title, rev: s.rev, drawings: s.drawings.map((d) => ({ n: d.n, title: d.title })), callouts: s.callouts.map((c) => ({ n: c.n, sheet: c.sheet, from: c.from })) })),
    issues,
    counts: {
      sheets: sheets.length,
      drawings: sheets.reduce((a, s) => a + s.drawings.length, 0),
      callouts: sheets.reduce((a, s) => a + s.callouts.length, 0),
      dimStrings: dimStrings.length,
      errors: issues.filter((i) => i.level === 'error').length,
      warnings: issues.filter((i) => i.level === 'warning').length,
    },
    dimStrings,
    latestRev: revs.length ? Math.max(...revs) : null,
  };
}

function pt(it) {
  return it ? { x: it.cx, y: it.cy } : null;
}

export function checkFileName(name, latestRev, rules = DEFAULT_RULES) {
  const R = { ...DEFAULT_RULES, ...rules };
  const m = new RegExp(R.fileNamePattern).exec(name);
  if (!m) return [{ code: 'file-name', level: 'error', detail: `"${name}" should look like ${R.fileNameExample}` }];
  const rev = m[m.length - 1];
  if (latestRev != null && /^\d+$/.test(rev) && Number(rev) !== latestRev) {
    return [{ code: 'file-name-rev', level: 'error', detail: `"${name}" says R${rev}; the latest title-block revision is ${latestRev}` }];
  }
  return [];
}
