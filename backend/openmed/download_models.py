"""One-time artifact acquisition. Never reads patient data or database credentials."""
import json
from pathlib import Path
from huggingface_hub import snapshot_download

root = Path(__file__).resolve().parent
models = json.loads((root / "models.json").read_text())
for key, model in models.items():
    destination = root / "openmed-models" / key
    snapshot_download(model["id"], revision=model["revision"], local_dir=destination,
                      allow_patterns=["*.json", "*.txt", "*.safetensors", "README.md"])
    (destination / "nafes-model.json").write_text(json.dumps(model), encoding="utf-8")
    print(f"Prepared {key}: {model['revision']}")
