# Set Check: interior drawing sets, checked before your CAD lead opens them

A static, single-page demo, prepared by Santiago for the Artistic Elements CAD team.

It reads an exported interior drawing set (PDF) in the browser and checks:
- sheet numbers;
- the sheet index;
- every elevation, section and detail callout;
- drawing numbers and sheet types;
- revisions;
- the file name;
- dimension strings that must add up to their overall.

Each finding is marked with a redline cloud on the sheet.

The two test sets under `data/sets/` are drawn by a script to exercise the checker. They are not ArchiCAD output and not portfolio work.

## Run it

There is no build step. Serve the folder with any static server, for example `npx serve .`, and open the page.

On Vercel, import the folder as it is. `vercel.json` sends `X-Robots-Tag: noindex, nofollow`, and the page carries a matching robots meta tag.

A PDF you choose on the page is read in your browser and is not uploaded anywhere.

## Files

- `index.html`, `style.css`, `app.mjs`: the page.
- `engine/`: the checker, the same modules the tests run in Node.
- `vendor/`: pdf.js 6.5.438 (Apache 2.0) with its standard-font files, for reading and drawing PDFs.
- `data/sets/planted.pdf`: the test set with ten planted mistakes.
- `data/sets/clean.pdf`: the same set with nothing wrong.
- `data/results.json`: the measurements the page quotes.
- `fonts/`: Bodoni Moda and Overpass, both under the SIL Open Font License (licence files included).

## Measured

- **The test set with ten planted mistakes:** all ten found, plus the non-standard file name. Nothing else was reported.
- **The clean test set:** 8 sheets, 14 drawings, 10 callouts and 18 dimension strings read, with 0 findings.
- **Each planted mistake drawn alone in a fresh set:** 10 of 10 found, with 0 false alarms.
- **20 seeded random dimension errors (1/2" to 12"):** 20 of 20 found, with 0 false alarms.
- **10 seeded random callouts to missing sheets or drawings:** 10 of 10 found, with 0 false alarms.
- **A 58-sheet set:** 160 callouts and 318 dimension strings read in about 0.12 s in Node, with 0 findings.
- **Unit and integration tests:** 23 of 23 pass. 20 of 20 bugs planted in the checker each make a test fail.
- **This page in headless Chromium:** 31 of 31 checks pass, with 0 axe-core violations at 1400 px and 390 px. There is no sideways scroll on a phone.

## Not measured

- **ArchiCAD exports:** no PDF exported from ArchiCAD has been checked. A real template's title-block labels and marker style need mapping once.
- **What the checker reads:** it reads text, not linework. A dimension whose text was typed over, or a string with no overall beside it, is not checked.
- **Model files:** it does not open .pln files.
- **Speed:** not measured on a full project set with heavy linework and images.
