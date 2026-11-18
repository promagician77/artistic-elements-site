// Turns a PDF into positioned text items with pdf.js. Works in Node and the browser:
// pass in the pdf.js module you loaded (legacy build in Node, the site's copy in the browser).

export function itemsFromTextContent(tc) {
  const out = [];
  for (const it of tc.items) {
    const str = (it.str || '').trim();
    if (!str) continue;
    const [a, b, , , e, f] = it.transform;
    const size = Math.hypot(a, b);
    const angle = Math.round((Math.atan2(b, a) * 180) / Math.PI);
    const w = it.width || 0;
    const rad = (angle * Math.PI) / 180;
    // centre of the run: half its length along the baseline, a third of the size above it
    const cx = e + Math.cos(rad) * (w / 2) - Math.sin(rad) * (size * 0.35);
    const cy = f + Math.sin(rad) * (w / 2) + Math.cos(rad) * (size * 0.35);
    out.push({ str, x: e, y: f, w, size: Math.round(size * 100) / 100, angle, cx, cy });
  }
  return out;
}

// standardFontDataUrl: pdf.js needs the standard-font metrics (Helvetica, Arial...) to measure text runs.
export async function extractPages(pdfjs, data, { standardFontDataUrl } = {}) {
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, standardFontDataUrl });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    pages.push({ n, width: vp.width, height: vp.height, items: itemsFromTextContent(tc) });
  }
  await task.destroy();
  return pages;
}
