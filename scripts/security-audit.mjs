import fs from 'fs';
import path from 'path';

const REPO_ROOT = process.cwd();

console.log('====================================================');
console.log('🔒 Tâm An Care Security & Secret Audit Scanner');
console.log(`Target: ${REPO_ROOT}`);
console.log('====================================================');

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/i, desc: 'Potential Hardcoded API Key' },
  { pattern: /(?:aws[_-]?access[_-]?key[_-]?id|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{16,})["']?/i, desc: 'AWS Credential Leak' },
  { pattern: /-----BEGIN\s+(?:RSA|EC|PGP|OPENSSH|PRIVATE)\s+KEY-----/, desc: 'Private Key File Content' },
  { pattern: /postgres:\/\/[^:]+:[^@]+@/i, desc: 'Hardcoded Database Password in URI' },
  { pattern: /eval\s*\([^)]+\)/, desc: 'Potentially Insecure eval() call' },
];

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.claude',
]);

const EXCLUDED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
  '.woff', '.woff2', '.ttf', '.eot', '.map', '.tsbuildinfo'
]);

let scannedCount = 0;
const findings = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDED_EXTS.has(ext) || entry.name === 'security-audit.mjs' || entry.name === 'security_check.py') {
        continue;
      }
      scannedCount++;
      scanFile(fullPath);
    }
  }
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments or example files
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
        continue;
      }
      if (filePath.endsWith('.env.example') || line.includes('example') || line.includes('placeholder')) {
        continue;
      }

      for (const { pattern, desc } of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          findings.push({
            file: path.relative(REPO_ROOT, filePath),
            line: i + 1,
            desc,
            snippet: trimmed.substring(0, 100),
          });
        }
      }
    }
  } catch (err) {
    // Ignore binary read errors
  }
}

scanDir(REPO_ROOT);

console.log(`Files scanned: ${scannedCount}`);
console.log(`Security findings: ${findings.length}`);
console.log('----------------------------------------------------');

if (findings.length > 0) {
  console.log('⚠️ Security Findings:');
  for (const f of findings) {
    console.log(`[!] ${f.desc} in ${f.file}:${f.line}`);
    console.log(`    ${f.snippet}`);
  }
  process.exit(1);
} else {
  console.log('✅ PASS: Zero hardcoded secrets, private keys, or unsafe eval() patterns detected.');
  process.exit(0);
}
