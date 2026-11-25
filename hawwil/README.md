# حوّل | Hawwil: PDF and image tools

Free, Arabic-first (RTL) PDF toolbox that runs entirely in your browser. No server, no sign-up, nothing is uploaded.

**Live:** https://ma2803575-cyber.github.io/Portfolio-Website/hawwil/

## Tools
- Images to PDF (JPG / PNG / WebP, reorder, A4 or fit-to-image, margins)
- Merge several PDFs into one
- Split: extract page ranges (e.g. 1-3,5) or one file per page
- Compress: recompresses only the images inside the PDF (JPEG and plain RGB/gray images, three levels, max 1200/1800/2600 px). Text, fonts and vectors are untouched, so text stays selectable and searchable. No page limit. Unsupported image types (e.g. JPEG2000, indexed or CMYK) are left as they are. PDFs that are mostly text will not shrink much, and the app says so
- Installable PWA, works offline after first load

## Stack
Vanilla HTML/CSS/JS, pdf-lib (build/merge/split), pdf.js, GitHub Pages.

Built by Ali Abo Zaid.
