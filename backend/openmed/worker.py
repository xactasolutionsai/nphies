"""Persistent, local-only OpenMed worker. JSON lines on stdin/stdout; no database access.

Protocol (one JSON object per line):
  worker -> {"type": "ready", "sdk_version": "2.3.0", "preloaded": [...]}        once, at start
  node   -> {"id": "<request id>", "text": "...", "mode": "medications|diseases"}
  worker -> {"id": "...", "ok": true, "result": {...}}  or  {"id": "...", "ok": false, "error": "<code>"}
Requests are handled one at a time. Models are loaded once per process (one OpenMed
ModelLoader, which caches pipelines) instead of once per text window as before.
Error codes never contain clinical text. stderr is discarded by the parent.
"""
import contextlib
import json
import os
from pathlib import Path
import socket
import sys
import time

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                  HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1", TOKENIZERS_PARALLELISM="false")


def deny_network(*args, **kwargs):
    raise RuntimeError("Network disabled in advisory worker")


socket.socket.connect = deny_network
socket.socket.connect_ex = deny_network
socket.socket.sendto = deny_network
socket.create_connection = deny_network
socket.getaddrinfo = deny_network

ROOT = Path(__file__).resolve().parent
MODELS = json.loads((ROOT / "models.json").read_text())
SDK_VERSION = "2.3.0"
MAX_TEXT = 12000
WINDOW, STRIDE = 256, 224          # overlapping token windows: long notes are not truncated
ARABIC = ("؀", "ۿ")


class WorkerError(Exception):
    """Carries an error code only; never clinical text."""


class OpenMedBackend:
    """Real backend: one ModelLoader for the process, tokenizers cached per mode."""

    def __init__(self):
        self._loader = None
        self._tokenizers = {}
        self._config = None

    def _model_path(self, mode):
        path = ROOT / "openmed-models" / mode
        manifest_file = path / "nafes-model.json"
        if not manifest_file.is_file() or not (path / "model.safetensors").is_file():
            raise WorkerError("model_unavailable")
        if json.loads(manifest_file.read_text()) != MODELS[mode]:
            raise WorkerError("model_unavailable")
        return path

    def _load(self, mode):
        path = self._model_path(mode)
        with contextlib.redirect_stdout(sys.stderr):
            import torch
            from openmed import ModelLoader, OpenMedConfig
            from transformers import AutoTokenizer
            torch.set_num_threads(int(os.environ.get("OPENMED_TORCH_THREADS", "2")))
            if self._loader is None:
                self._config = OpenMedConfig(device="cpu")
                self._loader = ModelLoader(self._config)
            if mode not in self._tokenizers:
                self._tokenizers[mode] = AutoTokenizer.from_pretrained(
                    path, local_files_only=True, trust_remote_code=False)
        return path

    def preload(self, mode):
        self._load(mode)

    def offsets(self, mode, text):
        self._load(mode)
        return self._tokenizers[mode](text, add_special_tokens=False,
                                      return_offsets_mapping=True)["offset_mapping"]

    def ner(self, mode, text):
        path = self._load(mode)
        with contextlib.redirect_stdout(sys.stderr):
            from openmed import analyze_text
            result = analyze_text(text, model_id=str(path), config=self._config, loader=self._loader,
                                  sentence_detection=False, cache_results=False,
                                  confidence_threshold=0.5, trust_remote_code=False)
        return [(e.start, e.end, e.label, float(e.confidence)) for e in result.entities]


def analyze(request, backend):
    mode = request.get("mode")
    if mode not in MODELS:
        raise WorkerError("unsupported_mode")
    text = request.get("text")
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= MAX_TEXT:
        raise WorkerError("invalid_input")
    # Avoid claiming English models have validated Arabic clinical support.
    if any(ARABIC[0] <= c <= ARABIC[1] for c in text):
        raise WorkerError("arabic_not_supported")
    started = time.perf_counter()
    offsets = backend.offsets(mode, text)
    tokenized = time.perf_counter()
    found = {}
    for index in range(0, len(offsets), STRIDE):
        window = offsets[index:index + WINDOW]
        begin, finish = window[0][0], window[-1][1]
        for start, end, label, confidence in backend.ner(mode, text[begin:finish]):
            start, end = begin + start, begin + end
            key = (start, end, label)
            entry = {"text": text[start:end], "label": label, "confidence": confidence, "start": start, "end": end}
            if key not in found or entry["confidence"] > found[key]["confidence"]:
                found[key] = entry
    finished = time.perf_counter()
    entities = sorted(found.values(), key=lambda item: (item["start"], item["end"]))
    return {"entities": entities, "model": MODELS[mode], "sdk_version": SDK_VERSION,
            "advisory_only": True, "language": "en",
            "timing_ms": {"tokenize": round((tokenized - started) * 1000, 1),
                          "infer": round((finished - tokenized) * 1000, 1),
                          "windows": max(1, -(-len(offsets) // STRIDE))}}


def serve(stdin, stdout, backend, preload=()):
    loaded = []
    for mode in preload:
        try:
            backend.preload(mode)
            loaded.append(mode)
        except Exception:
            pass
    stdout.write(json.dumps({"type": "ready", "sdk_version": SDK_VERSION, "preloaded": loaded}) + "\n")
    stdout.flush()
    for raw in stdin:
        if len(raw) > 100000:
            response = {"id": None, "ok": False, "error": "request_too_large"}
        else:
            request_id = None
            try:
                try:
                    request = json.loads(raw)
                except ValueError:
                    raise WorkerError("invalid_json")
                request_id = request.get("id") if isinstance(request, dict) else None
                if not isinstance(request_id, str) or not 1 <= len(request_id) <= 100:
                    raise WorkerError("invalid_request_id")
                response = {"id": request_id, "ok": True, "result": analyze(request, backend)}
            except WorkerError as error:
                response = {"id": request_id, "ok": False, "error": str(error)}
            except Exception:
                # Never expose library exceptions: they can contain clinical text.
                response = {"id": request_id, "ok": False, "error": "analysis_failed"}
        stdout.write(json.dumps(response, ensure_ascii=True, allow_nan=False) + "\n")
        stdout.flush()


if __name__ == "__main__":
    preload = [m for m in os.environ.get("OPENMED_PRELOAD", "").split(",") if m in MODELS]
    serve(sys.stdin, sys.stdout, OpenMedBackend(), preload)
