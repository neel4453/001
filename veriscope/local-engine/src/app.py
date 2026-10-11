"""
VeriScope local companion engine (OPTIONAL — the extension works fully without it).

Design rules (from the project spec):
  * Binds to 127.0.0.1 ONLY. Never a public interface.
  * Bearer-token auth (set VERISCOPE_TOKEN; the extension must send it).
  * CORS restricted to explicit chrome-extension origins you configure.
  * Files are processed in-memory/temp dirs and removed; nothing is uploaded anywhere.
  * 503 with an honest message when an optional dependency is missing — no fake success.

Run (from local-engine/):
  python -m venv .venv && . .venv/bin/activate
  pip install -r requirements.txt
  VERISCOPE_TOKEN=$(openssl rand -hex 16) \
  VERISCOPE_ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID \
  uvicorn src.app:app --host 127.0.0.1 --port 8756
"""
from __future__ import annotations

import os
import shutil
import tempfile
import time
from collections import defaultdict
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

TOKEN = os.environ.get("VERISCOPE_TOKEN", "")
ALLOWED = [o.strip() for o in os.environ.get("VERISCOPE_ALLOWED_ORIGINS", "").split(",") if o.strip()]
MAX_BODY = int(os.environ.get("VERISCOPE_MAX_BODY_MB", "64")) * 1024 * 1024
RATE_LIMIT_PER_MIN = int(os.environ.get("VERISCOPE_RATE_LIMIT", "30"))
WHISPER_BIN = os.environ.get("WHISPER_CPP_BIN", "")  # e.g. /usr/local/bin/whisper-cli

app = FastAPI(title="VeriScope local engine", version="1.0.0", docs_url=None, redoc_url=None)

if ALLOWED:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED,          # explicit only — never "*"
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

_hits: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def guards(request: Request, call_next):
    # 1) token
    if TOKEN:
        auth = request.headers.get("authorization", "")
        if auth != f"Bearer {TOKEN}":
            return JSONResponse({"detail": "missing or invalid token"}, status_code=401)
    elif os.environ.get("VERISCOPE_ALLOW_NO_AUTH", "") != "1":
        return JSONResponse({"detail": "engine refused to serve without VERISCOPE_TOKEN (set it, or explicitly VERISCOPE_ALLOW_NO_AUTH=1)"}, status_code=503)
    # 2) origin
    origin = request.headers.get("origin")
    if ALLOWED and origin and origin not in ALLOWED:
        return JSONResponse({"detail": "origin not allowed"}, status_code=403)
    # 3) naive per-client rate limit
    now = time.time()
    client = request.client.host if request.client else "?"
    hits = [t for t in _hits[client] if now - t < 60]
    if len(hits) >= RATE_LIMIT_PER_MIN:
        return JSONResponse({"detail": "rate limit"}, status_code=429)
    hits.append(now)
    _hits[client] = hits
    # 4) size
    cl = request.headers.get("content-length")
    if cl and int(cl) > MAX_BODY:
        return JSONResponse({"detail": f"body exceeds {MAX_BODY // (1024*1024)} MB cap"}, status_code=413)
    return await call_next(request)


@app.get("/health")
def health():
    feats = []
    if shutil.which("tesseract") or shutil.which("pdftoppm"):
        feats.append("ocr")
    if WHISPER_BIN and Path(WHISPER_BIN).exists():
        feats.append("transcribe")
    return {"ok": True, "version": "1.0.0", "features": feats}


def _require(mod, name):
    if mod is None:
        raise HTTPException(503, f"{name} not installed — run: pip install {name}")
    return mod


@app.post("/v1/ocr")
async def ocr(file: UploadFile = File(...)):
    """OCR a PDF or image with the locally installed Tesseract. Local only; no upload."""
    pytesseract = _require(_try("pytesseract"), "pytesseract")
    data = await file.read(MAX_BODY + 1)
    if len(data) > MAX_BODY:
        raise HTTPException(413, "file too large")
    suffix = Path(file.filename or "doc").suffix.lower() or ".png"
    with tempfile.TemporaryDirectory(prefix="veriscope-") as td:
        p = Path(td) / f"input{suffix}"
        p.write_bytes(data)
        try:
            if suffix == ".pdf":
                pdf2image = _require(_try("pdf2image"), "pdf2image (plus poppler-utils)")
                pages = pdf2image.convert_from_path(str(p), dpi=200)
                text = "\n\n".join(pytesseract.image_to_string(img) for img in pages)
            else:
                PIL = _require(_try("PIL"), "Pillow")
                img = PIL.Image.open(p)
                text = pytesseract.image_to_string(img)
        except HTTPException:
            raise
        except Exception as e:  # missing binaries, corrupt input...
            raise HTTPException(503, f"OCR failed locally: {e}")
    if not text.strip():
        raise HTTPException(422, "OCR produced no text — the image may be too low-quality; nothing was fabricated")
    return {
        "text": text,
        "warning": "OCR can misread names, numbers, equations and citations. Verify extracted figures visually.",
    }


@app.post("/v1/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Offline transcription through whisper.cpp (user-installed). Local only."""
    if not (WHISPER_BIN and Path(WHISPER_BIN).exists()):
        raise HTTPException(503, "whisper.cpp binary not configured (set WHISPER_CPP_BIN)")
    import subprocess

    with tempfile.TemporaryDirectory(prefix="veriscope-asr-") as td:
        p = Path(td) / "audio.bin"
        p.write_bytes(await file.read(MAX_BODY + 1))
        try:
            out = subprocess.run(
                [WHISPER_BIN, "-m", os.environ.get("WHISPER_MODEL", "ggml-base.en.bin"), "-f", str(p), "-oj"],
                capture_output=True, text=True, timeout=3600,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "transcription timed out")
        if out.returncode != 0:
            raise HTTPException(503, f"whisper.cpp failed: {out.stderr[-400:]}")
    return {"json": out.stdout[: 8 * 1024 * 1024]}


def _try(name: str):
    try:
        return __import__(name)
    except ImportError:
        return None


@app.exception_handler(Exception)
async def honest_errors(request, exc):  # never leak stack details to any origin
    return JSONResponse({"detail": f"local engine error: {type(exc).__name__}"}, status_code=500)
