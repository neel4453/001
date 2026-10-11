# VeriScope — optional local companion engine

The extension works fully **without** this engine. It exists for two features that are
impractical to bundle into an extension (scanned-PDF OCR and offline speech transcription)
without shipping hundreds of MB of models.

Everything here is free/open-source, runs only on your machine, listens only on
`127.0.0.1:8756`, and authenticates requests with a bearer token. Files are processed
locally and never sent anywhere else.

## Setup

```bash
cd local-engine
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
sudo apt install tesseract-ocr poppler-utils     # OCR engines (or brew equivalents)

export VERISCOPE_TOKEN=$(openssl rand -hex 16)  # REQUIRED: token the extension must send
export VERISCOPE_ALLOWED_ORIGINS=chrome-extension://<your-extension-id>
uvicorn src.app:app --host 127.0.0.1 --port 8756
```

Find your extension ID on `chrome://extensions` after loading VeriScope unpacked, then put
the same values in the extension (Settings → local companion engine).

### Optional: offline transcription (whisper.cpp)

1. Build [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (free, local).
2. `export WHISPER_CPP_BIN=/path/to/whisper-cli` and `export WHISPER_MODEL=/path/to/ggml-*.bin`.
3. Restart the engine; `/health` should list `transcribe`.

**Resource requirements:** Tesseract ≈ 300 MB disk; whisper.cpp base model ≈ 150 MB RAM,
large-v3 ≈ 3 GB RAM and noticeable CPU. Expect slow transcription on low-power hardware.

## Security notes

- Binds to loopback only; CORS allow-list is explicit origins (never `*`).
- Refuses to serve at all unless a token is configured (or you explicitly override).
- Naive per-client rate limiting and a body-size cap; corrupt input returns 5xx with an
  honest message and fabricates nothing.
- Do not expose this port to your network; it processes arbitrary files you send it.
