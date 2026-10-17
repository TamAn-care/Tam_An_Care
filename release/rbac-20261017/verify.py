#!/usr/bin/env python3
"""Verify frozen RBAC source and optionally compare rebuilds with observed runtime."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rebuilt', action='store_true')
args = parser.parse_args()
binding = json.loads((root / 'binding.json').read_text())
errors = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def runtime_hashes(name):
    result = {}
    for line in (root / 'evidence' / name).read_text().splitlines():
        sha, path = line.split(None, 1)
        result[path.strip().removeprefix('./')] = sha
    return result

for path, expected in binding['sourceFiles'].items():
    if digest(root / 'source' / path) != expected:
        errors.append('SOURCE: ' + path)

api = runtime_hashes('runtime-api.sha256')
frontend = runtime_hashes('runtime-frontend.sha256')
modules = json.loads((root / 'artifacts/healthsync-overlay/overlay-manifest.json').read_text())['modules']
for item in modules:
    path, expected = item['path'], item['sha256']
    if api.get(path) != expected:
        errors.append('API RUNTIME: ' + path)
    if args.rebuilt and digest(root / 'source/api' / path) != expected:
        errors.append('API REBUILD: ' + path)

for path, expected in binding['frontend']['overlayFileHashes'].items():
    if frontend.get(path) != expected:
        errors.append('FRONTEND RUNTIME: ' + path)
    if args.rebuilt and digest(root / 'source/frontend/dist' / path) != expected:
        errors.append('FRONTEND REBUILD: ' + path)

print(json.dumps({'sourceFiles': len(binding['sourceFiles']), 'apiModules': len(modules),
                  'frontendFiles': len(binding['frontend']['overlayFileHashes']),
                  'rebuilt': args.rebuilt, 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
