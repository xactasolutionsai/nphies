"""Single-request, local-only advisory worker. stdin/stdout JSON; no database access."""
import contextlib
import json
import os
from pathlib import Path
import socket
import sys

os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
                  HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1", TOKENIZERS_PARALLELISM="false")

def deny_network(*args, **kwargs):
    raise RuntimeError("Network disabled in advisory worker")

socket.socket.connect = deny_network
socket.socket.connect_ex = deny_network
socket.socket.sendto = deny_network
socket.create_connection = deny_network

ROOT = Path(__file__).resolve().parent
MODELS = json.loads((ROOT / "models.json").read_text())

def execute(request):
    mode = request.get("mode")
    if mode not in MODELS:
        raise ValueError("Unsupported mode")
    model_path = ROOT / "openmed-models" / mode
    manifest = json.loads((model_path / "nafes-model.json").read_text())
    if manifest != MODELS[mode] or not (model_path / "model.safetensors").is_file():
        raise ValueError("Model artifacts unavailable")
    text = request.get("text")
    if not isinstance(text, str) or not 1 <= len(text.strip()) <= 12000:
        raise ValueError("Invalid input")
    # Avoid claiming English models have validated Arabic clinical support.
    if any("\u0600" <= c <= "\u06ff" for c in text):
        raise ValueError("This configured model supports English input only")
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        from openmed import analyze_text, OpenMedConfig
        torch.set_num_threads(2)
        result = analyze_text(text, model_id=str(model_path), config=OpenMedConfig(device="cpu"),
                              sentence_detection=False, cache_results=False,
                              confidence_threshold=0.5, trust_remote_code=False)
    entities = [{"text": entity.text, "label": entity.label,
                 "confidence": float(entity.confidence), "start": entity.start, "end": entity.end}
                for entity in result.entities]
    return {"entities": entities, "model": MODELS[mode], "sdk_version": "2.3.0",
            "advisory_only": True, "language": "en"}

if __name__ == "__main__":
    try:
        request = json.loads(sys.stdin.buffer.read(100000).decode("utf-8"))
        output = execute(request)
        sys.stdout.write(json.dumps(output, ensure_ascii=True, allow_nan=False))
    except Exception:
        # Never expose library exceptions containing clinical text.
        sys.stdout.write(json.dumps({"error": "Local model unavailable or analysis failed"}))
        sys.exit(1)
