# Dependencies & licensing (audited against package metadata at build time)

Runtime (all bundled at build; nothing fetched remotely at runtime):

| Package | Version | License | Role |
|---|---|---|---|
| react / react-dom | ^18.3 | MIT | UI |
| pdfjs-dist | ^4.10 | Apache-2.0 | local PDF text extraction (worker bundled) |
| fflate | ^0.8 | MIT | DOCX zip reader |
| exifr | ^7.1 | MIT | EXIF/XMP/GPS local metadata |

Dev/build (not shipped): vite, @vitejs/plugin-react (MIT), typescript (BSD-2), vitest, jsdom
(MIT), @testing-library/react & dom (MIT), eslint + typescript-eslint (MIT), @types/* (MIT),
globals (MIT), @vitejs types (MIT). All permissive (MIT/Apache-2.0/BSD); compatible with this
project's MIT license. Verify anytime: `npm ls --depth=0`, `npx -y license-checker --production`
(free, runs against local node_modules).

No runtime dependency touches the network except the browser's own fetch to the documented
key-free public APIs (see PRIVACY.md). Fonts/icons: system font stack + locally generated PNGs.
Python (optional engine): FastAPI/Uvicorn (MIT), python-multipart (MIT), Pillow (MIT/CNRI),
pytesseract (GPL-2 — separate optional process, not linked to the extension), pdf2image (MIT).
whisper.cpp: MIT, user-installed binary — nothing bundled.
