# Self-hosted OCR assets

Pinned upstream distributions; do not edit the vendor code.

- `tesseract.min.js`, `worker.min.js`: Tesseract.js **6.0.1**, https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/
- Four `tesseract-core*.wasm.js` files: tesseract.js-core **6.1.2**, https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2/ . Each includes its WebAssembly binary. The worker selects the appropriate SIMD/LSTM build; no legacy detection feature is enabled.
- `eng.traineddata`: https://github.com/tesseract-ocr/tessdata_fast/blob/87416418657359cb625c412a48b6e1d6d41c29bd/eng.traineddata
- Upstream Apache-2.0 licenses and bundled third-party notices are included alongside these files.

All browser paths are explicitly overridden to this directory. There is no image upload or model API call. Only source code/model files are downloaded; OCR and parsing happen on the user's device. Language-data IndexedDB caching is disabled; normal browser HTTP caching still applies.

Maintenance: update pinned versions together, preserve licenses/notices, and run a real browser OCR fixture with request monitoring before publishing. The normal page must not load these assets until an image scan is requested.
