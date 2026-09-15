#!/usr/bin/env python3
"""
Tâm An Care Security & Secret Leak Scanner
Scans the codebase for hardcoded passwords, exposed API keys, private keys,
untracked .env files, and insecure configurations.
"""

import sys
import os
import re
from pathlib import Path

# High entropy secret patterns & sensitive regexes
SECRET_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["\']([A-Za-z0-9_\-]{16,})["\']', "Potential Hardcoded API Key"),
    (r'(?i)(aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*["\']?([A-Za-z0-9/+=]{16,})["\']?', "AWS Credentials Leak"),
    (r'(?i)bearer\s+[A-Za-z0-9\-\._~\+\/]{16,}=*', "Hardcoded Bearer Token"),
    (r'-----BEGIN\s+(RSA|EC|PGP|OPENSSH|PRIVATE)\s+KEY-----', "Private Key Leak"),
    (r'(?i)postgres://[^:]+:[^@]+@', "Hardcoded Database Connection String Password"),
    (r'(?i)mongodb(\+srv)?://[^:]+:[^@]+@', "Hardcoded MongoDB Password"),
    (r'(?i)mysql://[^:]+:[^@]+@', "Hardcoded MySQL Password"),
]

# File patterns to exclude from secret scanning (build output, node_modules, lockfiles, git, agent toolkits)
EXCLUDED_DIRS = {'.git', '.agents', 'node_modules', 'dist', 'build', '.next', '.idea', '.vscode', 'coverage', 'checkpoints'}
EXCLUDED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot', '.map'}

def scan_file(file_path):
    # Don't scan security_check.py itself for regex definitions
    if file_path.name in ['security_check.py', 'security_scan.py']:
        return []

    findings = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            for line_idx, line in enumerate(lines, 1):
                clean_line = line.strip()
                # Skip comments or documentation references if benign
                if clean_line.startswith('#') or clean_line.startswith('//') or clean_line.startswith('*'):
                    if any(kw in clean_line.lower() for kw in ['example', 'placeholder', 'your_strong_', 'mock']):
                        continue

                # Skip standard authentication error messages or documentation strings
                if 'Bearer authentication is required' in clean_line or 'Bearer token' in clean_line:
                    continue

                for pattern, desc in SECRET_PATTERNS:
                    matches = re.findall(pattern, line)
                    if matches:
                        matched_str = str(matches[0])
                        if any(p in matched_str.lower() for p in ['example', 'placeholder', 'change-this', '<', '>', 'your_', 'mock', 'sk_live_1234567890']):
                            continue
                        findings.append({
                            'file': str(file_path),
                            'line': line_idx,
                            'description': desc,
                            'snippet': clean_line[:100]
                        })
    except Exception as e:
        pass
    return findings

def check_env_files(root_dir):
    findings = []
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            if file == '.env' or (file.startswith('.env.') and not file.endswith('.example')):
                env_path = os.path.join(root, file)
                findings.append({
                    'file': env_path,
                    'line': 0,
                    'description': "Exposed .env file found in workspace (Should be ignored by git & not committed)",
                    'snippet': file
                })
    return findings

def check_gitignore(root_dir):
    gitignore_path = os.path.join(root_dir, '.gitignore')
    if not os.path.exists(gitignore_path):
        return [{'file': str(root_dir), 'line': 0, 'description': "Missing root .gitignore file", 'snippet': '.gitignore'}]
    
    with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    required_ignores = ['.env', 'node_modules', '*.pem', '*.key']
    missing = [req for req in required_ignores if req not in content]
    if missing:
        return [{'file': gitignore_path, 'line': 0, 'description': f"Missing critical .gitignore entries: {', '.join(missing)}", 'snippet': gitignore_path}]
    return []

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    target_path = Path(target_dir).resolve()
    print(f"==================================================")
    print(f"🔒 Tâm An Care Security & Secret Leak Scanner")
    print(f"Target Directory: {target_path}")
    print(f"==================================================")

    all_findings = []
    
    # 1. Check Gitignore rules
    all_findings.extend(check_gitignore(target_path))

    # 2. Check for tracked .env files
    all_findings.extend(check_env_files(target_path))

    # 3. Scan code files for hardcoded secrets
    scanned_count = 0
    for root, dirs, files in os.walk(target_path):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXCLUDED_EXTENSIONS:
                continue
            
            file_path = Path(root) / file
            scanned_count += 1
            findings = scan_file(file_path)
            all_findings.extend(findings)

    print(f"Scanned files: {scanned_count}")
    print(f"Total findings: {len(all_findings)}")
    print(f"--------------------------------------------------")

    if all_findings:
        print("⚠️ SECURITY FINDINGS DETECTED:")
        for idx, item in enumerate(all_findings, 1):
            print(f"[{idx}] {item['description']}")
            print(f"    File: {item['file']}:{item['line']}")
            if item['snippet']:
                print(f"    Code: {item['snippet']}")
            print()
        sys.exit(1)
    else:
        print("✅ SUCCESS: No security leaks or hardcoded secrets found!")
        sys.exit(0)

if __name__ == '__main__':
    main()
