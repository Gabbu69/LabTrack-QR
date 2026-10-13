"""Package the reviewed documents and credential-free working source.

Run after rendering and checking every final document page. This prepares local
archives only; source release still follows confirmed final payment.
"""
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "output" / "handoff"
PREFIX = "LabTrack-QR/"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def allowed(relative):
    path = Path(relative)
    denied = {".git", ".vercel", ".supabase", ".impeccable", "node_modules", ".next", ".temp", ".branches", "__pycache__", "playwright-report", "test-results"}
    if any(part.lower() in denied for part in path.parts):
        return False
    if any(part.lower().startswith(".env") and part != ".env.example" for part in path.parts):
        return False
    if path.parts[0] == "output":
        return False
    return True


def archive(name, entries, base_commit):
    contents = {relative: path.read_bytes() for relative, path in entries.items()}
    working_copy = bool(subprocess.check_output(
        ["git", "status", "--porcelain", "--untracked-files=normal"], cwd=ROOT, text=True
    ).strip())
    manifest = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "base_commit": base_commit,
        "version": "reviewed working copy based on recorded commit" if working_copy else "committed source at recorded commit",
        "working_copy_changes": working_copy,
        "source_release": "after confirmed final balance",
        "files": {relative: digest(data) for relative, data in sorted(contents.items())},
    }
    target = DEST / name
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zipped:
        for relative, data in sorted(contents.items()):
            zipped.writestr(PREFIX + relative, data)
        zipped.writestr(PREFIX + "HANDOFF-MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    with zipfile.ZipFile(target) as zipped:
        assert zipped.testzip() is None
        found = json.loads(zipped.read(PREFIX + "HANDOFF-MANIFEST.json"))
        assert len(zipped.namelist()) == len(found["files"]) + 1
        for relative, expected in found["files"].items():
            assert digest(zipped.read(PREFIX + relative)) == expected
    zip_digest = digest(target.read_bytes())
    target.with_suffix(target.suffix + ".sha256").write_text(f"{zip_digest}  {name}\n", encoding="utf-8")
    return {"file": name, "members": len(contents) + 1, "bytes": target.stat().st_size, "sha256": zip_digest, "verified": True}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    base_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    documents = {}
    for stem in ("LabTrack-QR-Client-Guide", "LabTrack-QR-Payment-and-Service-Proposal"):
        for folder, extension in (("doc", "docx"), ("pdf", "pdf")):
            relative = f"output/{folder}/{stem}.{extension}"
            documents[relative] = ROOT / relative
    documents["output/pdf/LabTrack-Thesis-Evaluation-Worksheet.pdf"] = ROOT.parent / "output/pdf/LabTrack-Thesis-Evaluation-Worksheet.pdf"
    candidates = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT).decode().split("\0")
    source = {name: ROOT / name for name in candidates if name and allowed(name) and (ROOT / name).is_file()}
    assert ".env.example" in source
    assert not any(name.lower().endswith(".env.local") for name in source)
    source.update(documents)
    for screenshot in (ROOT / "output/playwright/client-guide").glob("*.png"):
        source[screenshot.relative_to(ROOT).as_posix()] = screenshot
    reports = [archive("LabTrack-QR-Client-Documents.zip", documents, base_commit), archive("LabTrack-QR-Source-For-Final-Handoff.zip", source, base_commit)]
    (DEST / "package-verification.json").write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(reports, indent=2))


if __name__ == "__main__":
    main()
