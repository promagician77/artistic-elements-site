import { extractPages } from './engine/pdftext.mjs';
import { checkSet, checkFileName, DEFAULT_RULES, MESSAGES } from './engine/setcheck.mjs';

const pdfjs = await import('./vendor/pdf.min.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const FONTS = new URL('./vendor/standard_fonts/', import.meta.url).href;

const SETS = {
  planted: { url: 'data/sets/planted.pdf', name: 'Sample Residence - Interiors FINAL v3.pdf' },
  clean: { url: 'data/sets/clean.pdf', name: 'TS-01_I-Set_CD_R2.pdf' },
};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n).toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

const state = { token: 0, task: null, doc: null, pages: null, name: '', report: null, findings: [], page: 1, active: null, zoom: false, rules: { ...DEFAULT_RULES }, renderTask: null };

// ---------- loading and checking ----------
// A newer load supersedes an older one still in progress; the older one stops quietly.
async function load(bytes, name) {
  const token = ++state.token;
  $('#summary').textContent = `Reading ${name}…`;
  const task = pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: FONTS, isEvalSupported: false });
  try {
    const doc = await task.promise;
    const pages = await extractPages(pdfjs, bytes.slice(), { standardFontDataUrl: FONTS });
    if (token !== state.token) { task.destroy(); return; }
    const old = state.task;
    Object.assign(state, { task, doc, pages, name });
    if (old) old.destroy();
    await run();
  } catch (err) {
    if (token !== state.token) return;
    throw err;
  }
}

function run() {
  const report = checkSet(state.pages, state.rules);
  const fileIssues = checkFileName(state.name, report.latestRev, state.rules).map((f) => ({ ...f, sheet: null, page: null, at: null }));
  state.report = report;
  state.findings = [...fileIssues, ...report.issues].map((f, i) => ({ ...f, k: i + 1 }));
  state.active = null;
  drawSummary();
  drawTabs();
  drawFindings();
  const first = state.findings.find((f) => f.page);
  return show(first ? first.page : 1);
}

function drawSummary() {
  const c = state.report.counts;
  const errors = state.findings.filter((f) => f.level === 'error').length;
  const warnings = state.findings.filter((f) => f.level === 'warning').length;
  const read = `${plural(c.sheets, 'sheet')}, ${plural(c.drawings, 'drawing')}, ${plural(c.callouts, 'callout')} and ${plural(c.dimStrings, 'dimension string')} read from <strong>${esc(state.name)}</strong>.`;
  const verdict = errors + warnings
    ? ` <span class="bad"><strong>${plural(errors, 'error')} and ${plural(warnings, 'warning')}.</strong></span>`
    : ' <span class="ok"><strong>Nothing to redline.</strong></span>';
  const unread = !c.drawings ? ' No drawing titles were found in the layout this checker expects; a real template needs its title block and markers mapped once.' : '';
  $('#summary').innerHTML = read + verdict + esc(unread);
}

function drawTabs() {
  $('#sheet-tabs').innerHTML = state.report.sheets.map((s) => {
    const here = state.findings.filter((f) => f.page === s.page);
    const err = here.some((f) => f.level === 'error');
    return `<button type="button" class="tab" data-page="${s.page}" aria-pressed="false">${esc(s.id || `Page ${s.page}`)}${here.length ? ` <span class="n ${err ? '' : 'warn'}">${here.length}</span><span class="visually-hidden"> ${here.length === 1 ? 'finding' : 'findings'}</span>` : ''}</button>`;
  }).join('');
}

function where(f) {
  if (!f.page) return 'File name';
  const s = state.report.sheets.find((x) => x.page === f.page);
  return `${s?.id || `Page ${f.page}`}${f.sheet && s && f.sheet !== s.id ? `, about ${f.sheet}` : ''}`;
}

function drawFindings() {
  if (!state.findings.length) {
    $('#findings').innerHTML = `<li class="clear-note">No findings on ${plural(state.report.counts.sheets, 'sheet')}.</li>`;
    return;
  }
  $('#findings').innerHTML = state.findings.map((f) => `
    <li><button type="button" class="finding ${f.level === 'warning' ? 'warn' : ''}" data-k="${f.k}">
      <span class="k" aria-hidden="true">${f.k}</span>
      <span><span class="what">${esc(MESSAGES[f.code][1])}</span><span class="where">${esc(where(f))}${f.level === 'warning' ? ', warning' : ''}</span><span class="detail">${esc(f.detail)}</span></span>
    </button></li>`).join('');
}

// ---------- the sheet and its redlines ----------
function cloudPath(cx, cy, r) {
  const n = 12;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const bump = (2 * Math.PI * r) / n * 0.62;
  return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ` + pts.map((_, i) => {
    const p = pts[(i + 1) % n];
    return `A${bump.toFixed(1)},${bump.toFixed(1)} 0 0 1 ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  }).join(' ') + ' Z';
}

async function show(pageNo, focus = null) {
  state.page = pageNo;
  const page = await state.doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const fit = ($('#paper').clientWidth - 2) / base.width;
  const scale = state.zoom && focus ? fit * 2.6 : fit;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = $('#canvas');
  if (state.renderTask) state.renderTask.cancel();
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  const cssW = vp.width / dpr;
  const cssH = vp.height / dpr;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  $('#stage').style.width = `${cssW}px`;
  $('#stage').style.height = `${cssH}px`;
  state.renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, canvas });
  try { await state.renderTask.promise; } catch (e) { if (e?.name !== 'RenderingCancelledException') throw e; return; }
  state.renderTask = null;

  const here = state.findings.filter((f) => f.page === pageNo && f.at);
  const r = state.zoom && focus ? 34 : Math.max(11, Math.min(18, 26 * fit));
  const svg = $('#overlay');
  svg.setAttribute('width', cssW);
  svg.setAttribute('height', cssH);
  svg.setAttribute('viewBox', `0 0 ${cssW} ${cssH}`);
  svg.innerHTML = here.map((f) => {
    const x = f.at.x * scale;
    const y = (base.height - f.at.y) * scale;
    const warn = f.level === 'warning' ? ' warn' : '';
    const tx = x + r * 0.95;
    const ty = y - r * 0.95;
    return `<path class="cloud${warn}${state.active === f.k ? ' active' : ''}" data-k="${f.k}" d="${cloudPath(x, y, r)}"/><g class="tag${warn}"><circle cx="${tx}" cy="${ty}" r="10"/><text x="${tx}" y="${ty + 4}" text-anchor="middle">${f.k}</text></g>`;
  }).join('');

  const s = state.report.sheets.find((x) => x.page === pageNo);
  $('#sheet-label').textContent = `${s?.id || `Page ${pageNo}`}${s?.title ? `, ${s.title.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}` : ''}`;
  $('#caption').textContent = here.length ? `${plural(here.length, 'redline')} on this sheet. Numbers match the findings list.` : 'No redlines on this sheet.';
  for (const b of document.querySelectorAll('#sheet-tabs .tab')) b.setAttribute('aria-pressed', String(Number(b.dataset.page) === pageNo));
  if (focus && state.zoom) {
    const paper = $('#paper');
    paper.scrollLeft = Math.max(0, focus.x * scale - paper.clientWidth / 2);
    paper.scrollTop = Math.max(0, (base.height - focus.y) * scale - paper.clientHeight / 2);
  } else {
    $('#paper').scrollTo(0, 0);
  }
}

function select(k) {
  const f = state.findings.find((x) => x.k === k);
  state.active = k;
  for (const b of document.querySelectorAll('.finding')) b.setAttribute('aria-current', String(Number(b.dataset.k) === k));
  if (f.page) show(f.page, f.at);
}

// ---------- wiring ----------
async function loadSet(key) {
  for (const b of document.querySelectorAll('.src[data-set]')) b.setAttribute('aria-pressed', String(b.dataset.set === key));
  const bytes = new Uint8Array(await (await fetch(SETS[key].url)).arrayBuffer());
  await load(bytes, SETS[key].name);
}

document.querySelector('.sources').addEventListener('click', (e) => {
  const b = e.target.closest('.src[data-set]');
  if (b) loadSet(b.dataset.set);
});
$('#own-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  for (const b of document.querySelectorAll('.src[data-set]')) b.setAttribute('aria-pressed', 'false');
  try { await load(new Uint8Array(await f.arrayBuffer()), f.name); } catch (err) { $('#summary').textContent = `That file could not be read as a PDF: ${err.message}`; }
});
$('#sheet-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) {
    state.active = null;
    for (const f of document.querySelectorAll('.finding')) f.setAttribute('aria-current', 'false');
    show(Number(b.dataset.page));
  }
});
$('#findings').addEventListener('click', (e) => {
  const b = e.target.closest('.finding');
  if (b) select(Number(b.dataset.k));
});
$('#zoom').addEventListener('click', () => {
  state.zoom = !state.zoom;
  $('#zoom').setAttribute('aria-pressed', String(state.zoom));
  const f = state.findings.find((x) => x.k === state.active && x.page === state.page);
  show(state.page, f ? f.at : null);
});
$('#rule-sheet').value = DEFAULT_RULES.sheetPattern;
$('#rule-file').value = DEFAULT_RULES.fileNamePattern;
$('#file-example').textContent = DEFAULT_RULES.fileNameExample;
$('#recheck').addEventListener('click', () => {
  try {
    new RegExp($('#rule-sheet').value);
    new RegExp($('#rule-file').value);
  } catch (err) {
    $('#summary').textContent = `That pattern is not a valid regular expression: ${err.message}`;
    return;
  }
  state.rules = { ...state.rules, sheetPattern: $('#rule-sheet').value, fileNamePattern: $('#rule-file').value };
  run();
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.doc) show(state.page); }, 200); });

// ---------- the rest of the page ----------
async function drawResults() {
  const d = await (await fetch('data/results.json')).json();
  const planted = Object.fromEntries(d.planted.mistakes.map((m) => [m.code, m.label]));
  planted['file-name'] = 'The PDF is named "Sample Residence - Interiors FINAL v3.pdf"';
  $('#checks-body').innerHTML = Object.entries(MESSAGES).map(([code, [level, text]]) => `
    <tr><td>${esc(text)}</td><td class="sev"><span class="sev-${level}">${level === 'error' ? 'Error' : 'Warning'}</span></td><td>${planted[code] ? esc(planted[code]) : '<span class="hint">Not planted in the test set; covered by unit tests</span>'}</td></tr>`).join('');
  const v = d.variants;
  const measured = [
    `The test set with ten planted mistakes: all ten found, and the file name flagged, with nothing else reported.`,
    `The clean test set: 8 sheets, 14 drawings, 10 callouts and 18 dimension strings read, and 0 findings.`,
    `Each planted mistake drawn on its own in a fresh set: ${v.single.found} of ${v.single.total} found, ${v.single.falseAlarms} false alarms.`,
    `${v.randomDimension.total} seeded random dimension errors, from 1/2" to 12": ${v.randomDimension.found} found, ${v.randomDimension.falseAlarms} false alarms.`,
    `${v.randomCallout.total} seeded random callouts to missing sheets or drawings: ${v.randomCallout.found} found, ${v.randomCallout.falseAlarms} false alarms.`,
    `A ${d.long.sheets}-sheet set with ${fmt(d.long.callouts)} callouts and ${fmt(d.long.dimStrings)} dimension strings checked in ${fmt(d.long.ms)} ms in Node, with ${d.long.findings} findings.`,
    `${d.tests.pass} of ${d.tests.total} unit and integration tests pass${d.mutation ? `; ${d.mutation.caught} of ${d.mutation.mutants} bugs planted in the checker on purpose make a test fail` : ''}.`,
    d.siteQa && `This page: ${d.siteQa.passed} of ${d.siteQa.total} browser checks pass, with ${d.siteQa.axeViolations} accessibility violations found by axe-core at desktop and phone widths.`,
  ].filter(Boolean);
  const notMeasured = [
    'No PDF exported from ArchiCAD has been checked yet. Your title block labels and marker style need mapping once, which is the first thing to do in the paid trial.',
    'Dimensions are read from text only. A dimension string whose text was typed over, or which has no overall beside it, is not checked.',
    'Nothing here opens a .pln file. The checker reads the published PDF, which is what the designer and the builder see.',
    'Speed on a full project set with heavy linework and images; the timing above is for script-drawn sheets.',
    'The ArchiCAD facts above come from Graphisoft’s support pages and community answers, not from a test on your machines.',
  ];
  $('#measured-list').innerHTML = measured.map((m) => `<li>${esc(m)}</li>`).join('');
  $('#not-measured-list').innerHTML = notMeasured.map((m) => `<li>${esc(m)}</li>`).join('');
}

try {
  await Promise.all([loadSet('planted'), drawResults()]);
} finally {
  document.documentElement.dataset.ready = 'true';
}
