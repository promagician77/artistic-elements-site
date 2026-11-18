// The test drawing set, as data: a clean interior CD set for a sample residence (kitchen, bar, media wall),
// ten single mistakes of the kind a CAD lead redlines, and seeded random variants for the drills.
// gen/draw_set.py draws a PDF from any of these specs. Dimensions are in inches.

const cl = (n, sheet, at, dir = 'N') => ({ n, sheet, at, dir });

export const PROJECT = {
  name: 'Sample Residence',
  number: 'TS-01',
  phase: 'Construction Documents',
  date: 'November 18, 2026',
  note: 'Test set for Set Check, drawn by script. Not drawn in ArchiCAD and not a portfolio project.',
};

export function cleanSpec() {
  const sheets = [
    { id: 'I-000', title: 'COVER SHEET AND SHEET INDEX', rev: 2, kind: 'cover', drawings: [] },
    {
      id: 'I-101', title: 'FLOOR PLAN', rev: 2, kind: 'sheet', drawings: [{
        n: 1, title: 'FLOOR PLAN - KITCHEN AND GREAT ROOM', scale: '1/4" = 1\'-0"', art: 'plan', slot: 'full',
        // callout positions in feet from the room's south-west corner
        callouts: [cl(1, 'I-201', [13, 14.2], 'N'), cl(2, 'I-201', [24.2, 12], 'E'), cl(3, 'I-201', [4.2, 9], 'W'),
          cl(1, 'I-202', [3.6, 3.2], 'W'), cl(2, 'I-202', [15, 3.8], 'S'), cl(1, 'I-301', [17.6, 9.6], 'E')],
        dims: [
          { axis: 'h', chain: [54, 120, 72, 114], overall: 360, at: 'top' },
          { axis: 'v', chain: [96, 144], overall: 240, at: 'left' },
        ],
      }],
    },
    {
      id: 'I-102', title: 'REFLECTED CEILING PLAN', rev: 2, kind: 'sheet', drawings: [{
        n: 1, title: 'REFLECTED CEILING PLAN - KITCHEN AND GREAT ROOM', scale: '1/4" = 1\'-0"', art: 'rcp', slot: 'full',
        callouts: [cl(2, 'I-301', [15, 6.4], 'S')],
        dims: [{ axis: 'h', chain: [90, 180, 90], overall: 360, at: 'top' }],
      }],
    },
    {
      id: 'I-201', title: 'KITCHEN ELEVATIONS', rev: 2, kind: 'sheet', drawings: [
        elevation(1, 'KITCHEN - NORTH ELEVATION', 'tl', [['tall', 24], ['base', 30], ['dw', 24], ['sink', 36], ['base', 18], ['fridge', 36]], [cl(1, 'I-501', [0.36, 0.2])]),
        elevation(2, 'KITCHEN - EAST ELEVATION', 'tr', [['base', 33], ['range', 48], ['base', 33], ['open', 36]], []),
        elevation(3, 'KITCHEN - WEST ELEVATION', 'bl', [['tall', 36], ['tall', 36], ['base', 30]], []),
      ],
    },
    {
      id: 'I-202', title: 'BAR AND MEDIA WALL ELEVATIONS', rev: 2, kind: 'sheet', drawings: [
        elevation(1, 'BAR - WEST ELEVATION', 'l', [['base', 18], ['wine', 24], ['sink', 30], ['base', 18]], []),
        elevation(2, 'MEDIA WALL - SOUTH ELEVATION', 'r', [['tall', 30], ['open', 84], ['tall', 30]], []),
      ],
    },
    {
      id: 'I-301', title: 'SECTIONS', rev: 2, kind: 'sheet', drawings: [
        {
          n: 1, title: 'SECTION AT ISLAND', scale: '1/2" = 1\'-0"', art: 'section-island', slot: 'l',
          callouts: [cl(2, 'I-501', [0.62, 0.3])],
          dims: [{ axis: 'v', chain: [36, 66, 18], overall: 120, at: 'left' }],
        },
        {
          n: 2, title: 'SECTION AT COFFERED CEILING', scale: '1/2" = 1\'-0"', art: 'section-coffer', slot: 'r',
          callouts: [cl(3, 'I-501', [0.7, 0.78])],
          dims: [{ axis: 'v', chain: [120, 12], overall: 132, at: 'left' }],
        },
      ],
    },
    {
      id: 'I-501', title: 'MILLWORK DETAILS', rev: 2, kind: 'sheet', drawings: [
        { n: 1, title: 'TOE KICK AND COUNTERTOP DETAIL', scale: '1" = 1\'-0"', art: 'detail-toekick', slot: 'tl', callouts: [],
          dims: [{ axis: 'v', chain: [4.5, 30, 1.5], overall: 36, at: 'left' }] },
        { n: 2, title: 'ISLAND END PANEL DETAIL', scale: '3" = 1\'-0"', art: 'detail-panel', slot: 'tr', callouts: [],
          dims: [{ axis: 'h', chain: [0.75, 23.25, 0.75], overall: 24.75, at: 'bottom' }] },
        { n: 3, title: 'CROWN AT COFFER DETAIL', scale: '3" = 1\'-0"', art: 'detail-crown', slot: 'bl', callouts: [],
          dims: [{ axis: 'v', chain: [3.5, 5.25], overall: 8.75, at: 'left' }] },
      ],
    },
    {
      id: 'I-601', title: 'SCHEDULES', rev: 2, kind: 'sheet', drawings: [
        { n: 1, title: 'FINISH SCHEDULE', scale: 'NO SCALE', art: 'schedule-finish', slot: 'top', callouts: [], dims: [] },
        { n: 2, title: 'CABINET SCHEDULE', scale: 'NO SCALE', art: 'schedule-cabinet', slot: 'bottom', callouts: [], dims: [] },
      ],
    },
  ];
  return {
    project: PROJECT,
    fileName: 'TS-01_I-Set_CD_R2.pdf',
    index: sheets.map((s) => ({ id: s.id, title: s.title, rev: s.rev })),
    sheets,
  };
}

function elevation(n, title, slot, segments, callouts) {
  const widths = segments.map((s) => s[1]);
  return {
    n, title, scale: '3/8" = 1\'-0"', art: 'elevation', slot, callouts,
    segments: segments.map(([kind, w]) => ({ kind, w })),
    dims: [
      { axis: 'h', chain: widths, overall: widths.reduce((a, b) => a + b, 0), at: 'bottom' },
      { axis: 'v', chain: [36, 18, 42], overall: 96, at: 'left' },
    ],
  };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const sheet = (spec, id) => spec.sheets.find((s) => s.id === id);
const drawing = (spec, id, n) => sheet(spec, id).drawings.find((d) => d.n === n);

// Each mistake changes one thing and should produce exactly one finding.
export const MISTAKES = [
  { id: 'M1', expect: { code: 'callout-missing-drawing', sheet: 'I-101' }, label: 'A callout on the floor plan points to drawing 4 on I-201, which has only three drawings',
    apply: (s) => drawing(s, 'I-101', 1).callouts.push(cl(4, 'I-201', [20.5, 17], 'N')) },
  { id: 'M2', expect: { code: 'callout-missing-sheet', sheet: 'I-102' }, label: 'A callout on the ceiling plan points to sheet I-302, which is not in the set',
    apply: (s) => drawing(s, 'I-102', 1).callouts.push(cl(1, 'I-302', [6, 14], 'E')) },
  { id: 'M3', expect: { code: 'index-title-mismatch', sheet: 'I-202' }, label: 'The sheet index calls I-202 "BAR ELEVATIONS"; the sheet itself says "BAR AND MEDIA WALL ELEVATIONS"',
    apply: (s) => { s.index.find((r) => r.id === 'I-202').title = 'BAR ELEVATIONS'; } },
  { id: 'M4', expect: { code: 'sheet-not-in-index', sheet: 'I-601' }, label: 'Sheet I-601 is in the set but missing from the sheet index',
    apply: (s) => { s.index = s.index.filter((r) => r.id !== 'I-601'); } },
  { id: 'M5', expect: { code: 'index-missing-sheet', sheet: 'I-302' }, label: 'The sheet index lists I-302, which is not in the set',
    apply: (s) => { s.index.splice(s.index.findIndex((r) => r.id === 'I-301') + 1, 0, { id: 'I-302', title: 'CEILING SECTIONS', rev: 2 }); } },
  { id: 'M6', expect: { code: 'orphan-drawing', sheet: 'I-501' }, label: 'Detail 3 on I-501 is no longer called out from anywhere',
    apply: (s) => { drawing(s, 'I-301', 2).callouts = []; } },
  { id: 'M7', expect: { code: 'dims-dont-add-up', sheet: 'I-201' }, label: 'On the east kitchen elevation the cabinet widths add up to 12\'-6", but the overall reads 12\'-0"',
    apply: (s) => { drawing(s, 'I-201', 2).dims[0].overall = 144; } },
  { id: 'M8', expect: { code: 'index-rev-mismatch', sheet: 'I-301' }, label: 'The title block of I-301 says revision 1; the index says revision 2',
    apply: (s) => { sheet(s, 'I-301').rev = 1; } },
  { id: 'M9', expect: { code: 'wrong-sheet-type', sheet: 'I-301' }, label: 'An elevation sits on I-301, a sections sheet',
    apply: (s) => { drawing(s, 'I-301', 2).title = 'COFFERED CEILING ELEVATION'; } },
  { id: 'M10', expect: { code: 'duplicate-drawing-number', sheet: 'I-601' }, label: 'Both schedules on I-601 are numbered 1',
    apply: (s) => { drawing(s, 'I-601', 2).n = 1; } },
];

export function plantedSpec(ids = MISTAKES.map((m) => m.id)) {
  const s = clone(cleanSpec());
  for (const m of MISTAKES.filter((x) => ids.includes(x.id))) m.apply(s);
  s.fileName = 'Sample Residence - Interiors FINAL v3.pdf';
  return s;
}

export function singleMistakeSpec(id) {
  const s = clone(cleanSpec());
  MISTAKES.find((m) => m.id === id).apply(s);
  return s;
}

// Seeded random variants: a wrong cabinet width somewhere, or a callout to a drawing or sheet that does not exist.
export function randomVariants(count = 30, seed = 1118) {
  let x = seed >>> 0;
  const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = clone(cleanSpec());
    let expect;
    let label;
    if (i % 3 !== 2) {
      const withDims = s.sheets.flatMap((sh) => sh.drawings.filter((d) => d.dims.length).map((d) => [sh, d]));
      const [sh, d] = pick(withDims);
      const dim = pick(d.dims);
      const k = Math.floor(rnd() * dim.chain.length);
      const delta = (pick([1, -1]) * (8 + Math.floor(rnd() * 185))) / 16; // 1/2" to 12" in sixteenths
      const before = dim.chain[k];
      dim.chain[k] = Math.max(0.5, Math.round((before + delta) * 16) / 16);
      if (d.segments && dim.axis === 'h') d.segments[k].w = dim.chain[k];
      expect = { code: 'dims-dont-add-up', sheet: sh.id };
      label = `${sh.id} drawing ${d.n}: one ${dim.axis === 'h' ? 'horizontal' : 'vertical'} dimension changed from ${before}" to ${dim.chain[k]}"`;
    } else {
      const hosts = s.sheets.flatMap((sh) => sh.drawings.filter((d) => ['plan', 'rcp', 'elevation'].includes(d.art)).map((d) => [sh, d]));
      const [sh, d] = pick(hosts);
      const targets = s.sheets.filter((t) => t.kind === 'sheet');
      const toMissingSheet = rnd() < 0.4;
      let target;
      let n;
      if (toMissingSheet) { target = pick(['I-203', 'I-302', 'I-502', 'I-401']); n = 1 + Math.floor(rnd() * 3); }
      else { const t = pick(targets); target = t.id; n = Math.max(...t.drawings.map((q) => q.n)) + 1 + Math.floor(rnd() * 2); }
      const at = d.art === 'elevation' ? [0.15 + rnd() * 0.7, 0.55 + rnd() * 0.3] : [2 + rnd() * 26, 2 + rnd() * 16];
      d.callouts.push(cl(n, target, at, pick(['N', 'E', 'S', 'W'])));
      expect = { code: toMissingSheet ? 'callout-missing-sheet' : 'callout-missing-drawing', sheet: sh.id };
      label = `${sh.id} drawing ${d.n}: callout ${n}/${target} added`;
    }
    out.push({ id: `R${String(i + 1).padStart(2, '0')}`, spec: s, expect, label });
  }
  return out;
}

// A long set for timing: the clean set plus `extra` elevation sheets, each called out from the one before.
export function longSpec(extra = 50) {
  const s = clone(cleanSpec());
  const base = sheet(s, 'I-202');
  const at = s.sheets.indexOf(base);
  const added = [];
  for (let k = 0; k < extra; k++) {
    const id = `I-${203 + k}`;
    added.push({
      id, title: `MILLWORK ELEVATIONS ${k + 1}`, rev: 2, kind: 'sheet',
      drawings: [
        elevation(1, `BUILT-IN ${k + 1}A ELEVATION`, 'tl', [['tall', 24], ['base', 30], ['base', 30], ['tall', 24]], []),
        elevation(2, `BUILT-IN ${k + 1}B ELEVATION`, 'tr', [['base', 36], ['open', 48], ['base', 36]], []),
        elevation(3, `BUILT-IN ${k + 1}C ELEVATION`, 'bl', [['tall', 30], ['base', 33], ['base', 33]], []),
      ],
    });
  }
  // each sheet's first elevation calls out the next sheet's three drawings; I-202 starts the chain
  const host = (sh) => sh.drawings[sh.id === 'I-202' ? 1 : 0];
  [base, ...added].forEach((sh, i) => {
    const next = added[i];
    if (!next) return;
    host(sh).callouts.push(...[1, 2, 3].map((n, j) => cl(n, next.id, [0.2 + j * 0.25, 0.75])));
  });
  s.sheets.splice(at + 1, 0, ...added);
  s.index = s.sheets.map((x) => ({ id: x.id, title: x.title, rev: x.rev }));
  s.fileName = 'TS-01_I-Set_CD_R2.pdf';
  return s;
}
