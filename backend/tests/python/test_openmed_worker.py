"""Protocol tests for backend/openmed/worker.py with a fake backend (no model, no torch)."""
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "openmed"))
import worker  # noqa: E402


class FakeBackend:
    """Tokens are words; 'diabetes' and 'metformin' are entities. Counts model loads."""

    def __init__(self):
        self.loads = 0
        self.loaded = set()
        self.ner_calls = 0

    def _load(self, mode):
        if mode not in self.loaded:
            self.loaded.add(mode)
            self.loads += 1

    def preload(self, mode):
        self._load(mode)

    def offsets(self, mode, text):
        self._load(mode)
        out, i = [], 0
        for word in text.split(" "):
            out.append((i, i + len(word)))
            i += len(word) + 1
        return out

    def ner(self, mode, text):
        self._load(mode)
        self.ner_calls += 1
        if "__boom__" in text:
            raise RuntimeError("library error mentioning " + text)
        term = "metformin" if mode == "medications" else "diabetes"
        out, start = [], text.find(term)
        while start >= 0:
            out.append((start, start + len(term), "LABEL", 0.9))
            start = text.find(term, start + 1)
        return out


def run(lines, backend=None, preload=()):
    backend = backend or FakeBackend()
    stdout = io.StringIO()
    worker.serve(io.StringIO("".join(json.dumps(l) + "\n" if not isinstance(l, str) else l for l in lines)),
                 stdout, backend, preload)
    return [json.loads(l) for l in stdout.getvalue().splitlines()], backend


class WorkerProtocolTest(unittest.TestCase):
    def test_ready_then_one_response_per_request(self):
        out, _ = run([{"id": "a", "mode": "diseases", "text": "No diabetes today"}], preload=["diseases"])
        self.assertEqual(out[0], {"type": "ready", "sdk_version": "2.3.0", "preloaded": ["diseases"]})
        self.assertEqual(out[1]["id"], "a")
        self.assertTrue(out[1]["ok"])
        self.assertEqual([e["text"] for e in out[1]["result"]["entities"]], ["diabetes"])
        self.assertEqual(out[1]["result"]["advisory_only"], True)

    def test_model_loaded_once_across_requests_and_windows(self):
        long_text = " ".join(["word"] * 1000) + " diabetes"
        requests = [{"id": str(i), "mode": "diseases", "text": long_text} for i in range(3)]
        out, backend = run(requests)
        self.assertEqual(backend.loads, 1)
        self.assertGreater(backend.ner_calls, 3, "long text is split into several windows")
        for r in out[1:]:
            ent = r["result"]["entities"]
            self.assertEqual(len(ent), 1, "overlapping windows are de-duplicated")
            self.assertEqual(long_text[ent[0]["start"]:ent[0]["end"]], "diabetes")
            self.assertGreater(ent[0]["start"], 4000, "the tail of a long note is analysed")

    def test_requests_are_isolated(self):
        out, _ = run([{"id": "1", "mode": "diseases", "text": "diabetes"},
                      {"id": "2", "mode": "diseases", "text": "nothing relevant"}])
        self.assertEqual(out[2]["result"]["entities"], [])

    def test_errors_are_codes_without_clinical_text(self):
        out, _ = run([{"id": "1", "mode": "surgery", "text": "x"},
                      {"id": "2", "mode": "diseases", "text": "   "},
                      {"id": "3", "mode": "diseases", "text": "لا يوجد سكري"},
                      {"id": "4", "mode": "diseases", "text": "secret diabetes __boom__"},
                      "not json\n",
                      {"mode": "diseases", "text": "diabetes"},
                      {"id": "5", "mode": "diseases", "text": "x" * 12001}])
        self.assertEqual([(r["id"], r["error"]) for r in out[1:]], [
            ("1", "unsupported_mode"), ("2", "invalid_input"), ("3", "arabic_not_supported"),
            ("4", "analysis_failed"), (None, "invalid_json"), (None, "invalid_request_id"),
            ("5", "invalid_input")])
        self.assertNotIn("secret", json.dumps(out))

    def test_oversized_line_is_refused(self):
        out, _ = run(["x" * 100001 + "\n"])
        self.assertEqual(out[1], {"id": None, "ok": False, "error": "request_too_large"})

    def test_failed_preload_is_reported_not_fatal(self):
        class Broken(FakeBackend):
            def preload(self, mode):
                raise worker.WorkerError("model_unavailable")
        out, _ = run([{"id": "a", "mode": "diseases", "text": "diabetes"}], backend=Broken(), preload=["diseases"])
        self.assertEqual(out[0]["preloaded"], [])
        self.assertTrue(out[1]["ok"])


if __name__ == "__main__":
    unittest.main()
