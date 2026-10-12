#!/usr/bin/env python3
"""Patch ONLY the two periodic-report UI labels in an isolated copy of a full Production Test frontend.
Do not run against live source. Fails closed on unexpected structure.
"""
from pathlib import Path
import argparse
import re

HEALTH = "Báo cáo định kỳ Sức khoẻ"
PSYCH = "Báo cáo định kỳ Tâm lý"

def block_replace(text: str, marker: str, field: str, expected: str, desired: str) -> str:
    # Match an object block by its route/id marker without changing auth, URI, or policy.
    parts = re.split(r'(?m)^(?=\s*\{\s*$)', text)
    choices = [i for i, s in enumerate(parts) if marker in s and re.search(rf"\b{field}:\s*['\"]", s)]
    if len(choices) != 1:
        raise ValueError(f"Expected 1 {marker} {field} block, got {len(choices)}")
    i = choices[0]
    old = f"{field}: '{expected}'"
    if parts[i].count(old) != 1:
        raise ValueError(f"Unexpected label in {marker}: {field}")
    parts[i] = parts[i].replace(old, f"{field}: '{desired}'", 1)
    return ''.join(parts)

def apply(root: Path):
    nav = root / "src/components/navigation/AppNavigation.tsx"
    mobile = root / "src/features/mobile-launcher/MobileLauncherPage.tsx"
    meta = root / "src/app/page-meta.ts"
    psych_page = root / "src/features/psychosocial-periodic/PsychosocialPeriodicPage.tsx"
    for p in [nav, mobile, meta, psych_page]:
        if not p.is_file():
            raise ValueError(f"Missing runtime source {p}")

    content = {}
    n = nav.read_text()
    n = block_replace(n, "key: 'health-reports'", "label", "Báo Cáo Định Kỳ", HEALTH)
    n = block_replace(n, "key: 'psychosocial-reports'", "label", "Báo Cáo Định Kỳ", PSYCH)
    content[nav] = n

    m = mobile.read_text()
    m = block_replace(m, "id: 'health-reports'", "title", "Báo Cáo Định Kỳ", HEALTH)
    m = block_replace(m, "id: 'psychosocial-reports'", "title", "Báo Cáo Định Kỳ", PSYCH)
    content[mobile] = m

    p = meta.read_text()
    if p.count("title: 'Báo cáo Tâm lý – CTXH'") != 1:
        raise ValueError("Psychology page meta mismatch")
    if p.count("title: 'Báo cáo sức khỏe'") != 1:
        raise ValueError("Health page meta mismatch")
    content[meta] = p.replace("title: 'Báo cáo Tâm lý – CTXH'", f"title: '{PSYCH}'", 1).replace("title: 'Báo cáo sức khỏe'", f"title: '{HEALTH}'", 1)

    psych = psych_page.read_text()
    if psych.count("Báo cáo Tâm lý – CTXH định kỳ") != 1:
        raise ValueError("Psychology page title mismatch")
    content[psych_page] = psych.replace("Báo cáo Tâm lý – CTXH định kỳ", PSYCH, 1)

    # Transactional: no source file changed until all assertions above pass.
    for path, updated in content.items():
        path.write_text(updated)
        print(f"PATCHED={path.relative_to(root)}")
    print("REPORT_LABELS_PATCH=PASS")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--isolated-frontend-root", type=Path, required=True)
    args = parser.parse_args()
    root = args.isolated_frontend_root.resolve()
    if not root.name == "frontend" or "mobile-back-v10" in str(root):
        # Refuse writing approved production source and V11 build source.
        raise SystemExit("SAFE_STOP_USE_NEW_ISOLATED_CANDIDATE")
    apply(root)
