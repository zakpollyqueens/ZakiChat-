#!/usr/bin/env python3
"""Conservative source-tree scan for common accidental credential leaks."""
from pathlib import Path
import base64
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules", "build", "dist", ".gradle"}
TEXT_SUFFIXES = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".html",
    ".css", ".xml", ".yml", ".yaml", ".toml", ".gradle", ".properties",
    ".md", ".txt", ".sql", ".sh", ".py", ".java", ".kt", ".conf"
}
PATTERNS = [
    ("private key PEM", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Slack webhook URL", re.compile(r"https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+")),
    ("GitHub personal access token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("Supabase service-role JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
]
issues = []
tracked_env_names = {".env", ".env.local", ".env.production", ".env.development"}
for path in ROOT.rglob("*"):
    if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
        continue
    rel = path.relative_to(ROOT)
    if path.name in tracked_env_names or (path.name.startswith(".env.") and path.name != ".env.example"):
        issues.append(f"{rel}: environment file should not be committed (use GitHub/Supabase secrets)")
    if path.suffix.lower() not in TEXT_SUFFIXES or path.stat().st_size > 2_000_000:
        continue
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        continue
    for label, pattern in PATTERNS:
        for match in pattern.finditer(text):
            value = match.group(0)
            if label == "Supabase service-role JWT":
                try:
                    segment = value.split(".")[1]
                    segment += "=" * (-len(segment) % 4)
                    import json
                    payload = json.loads(base64.urlsafe_b64decode(segment))
                    if payload.get("role") != "service_role":
                        continue
                except Exception:
                    # If it looks JWT-like but cannot be decoded, flag for manual review.
                    pass
            issues.append(f"{rel}: possible {label} at character {match.start()} (value suppressed)")
if issues:
    print("Potential security findings (credential values intentionally suppressed):")
    for issue in issues:
        print(f"::error::{issue}")
    sys.exit(1)
print("No matching high-confidence secret patterns or committed environment files found.")
print("This static scan cannot inspect GitHub/Supabase secret stores or replace a full security review.")
