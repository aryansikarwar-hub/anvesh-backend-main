#!/usr/bin/env node
/**
 * Fails if anything that looks like a real credential is committed.
 * Placeholders inside .env.example are allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'uploads', 'playwright-report']);
const SKIP_FILES = new Set(['package-lock.json', 'check-secrets.mjs', 'openapi.json']);
const ALLOW_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.md', '.env', '']);

const PATTERNS = [
  [/\brzp_(live|test)_[A-Za-z0-9]{10,}/g, 'Razorpay key id'],
  [/\bre_[A-Za-z0-9]{20,}/g, 'Resend API key'],
  [/\bAIza[0-9A-Za-z\-_]{30,}/g, 'Google/Gemini API key'],
  [/\bsk-[A-Za-z0-9]{20,}/g, 'OpenAI-style secret key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, 'private key'],
  [/mongodb(\+srv)?:\/\/[^\s'"`]*:[^\s'"`@]{6,}@/g, 'MongoDB URI with password'],
];

const hits = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (st.size > 2_000_000) continue;
    if (!ALLOW_EXT.has(extname(entry)) && !entry.startsWith('.env')) continue;
    // Templates and documentation are allowed to show the shape of a
    // credential, as long as it is obviously not a real one.
    const isTemplate = entry === '.env.example' || extname(entry) === '.md';
    const text = readFileSync(full, 'utf8');
    for (const [re, label] of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (isTemplate && /(your|example|xxxx|placeholder|change_?me|USER:PASSWORD|user:password)/i.test(m[0])) {
          continue;
        }
        hits.push(`${full.replace(ROOT + '/', '')}: possible ${label} -> ${m[0].slice(0, 18)}…`);
      }
    }
  }
}
walk(ROOT);
if (hits.length) {
  console.error('Potential committed secrets found:\n' + hits.map((h) => '  - ' + h).join('\n'));
  process.exit(1);
}
console.warn('check:secrets — clean');
