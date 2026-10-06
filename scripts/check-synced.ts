import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

import {
  capabilitiesSchema,
  experienceSchema,
  identitySchema,
  manifestSchema,
  projectsDataSchema,
  statsSchema,
} from '../src/content/schemas';

const SYNCED = resolve('src', 'content', 'synced');
const EM_DASH = '\u2014';

type Check = { file: string; schema: { parse: (v: unknown) => unknown } };

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function scanEmDash(value: unknown, path: string, problems: string[]): void {
  if (typeof value === 'string') {
    if (value.includes(EM_DASH)) problems.push(`${path}: contains an em-dash (U+2014)`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanEmDash(v, `${path}[${i}]`, problems));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scanEmDash(v, `${path}.${k}`, problems);
  }
}

const checks: Check[] = [
  { file: 'identity.json', schema: identitySchema },
  { file: 'experience.json', schema: experienceSchema },
  { file: 'stats.json', schema: statsSchema },
  { file: 'capabilities.json', schema: capabilitiesSchema },
  { file: 'projects.json', schema: projectsDataSchema },
  { file: 'manifest.json', schema: manifestSchema },
];

const problems: string[] = [];

for (const { file, schema } of checks) {
  const path = join(SYNCED, file);
  if (!existsSync(path)) {
    problems.push(`${file}: missing`);
    continue;
  }
  const data = readJson(path);
  try {
    schema.parse(data);
  } catch (err) {
    problems.push(`${file}: ${(err as Error).message}`);
  }
  scanEmDash(data, file, problems);
}

// public/resume.json validates as JSON and contains a name.
const resumePath = resolve('public', 'resume.json');
if (existsSync(resumePath)) {
  const resume = readJson(resumePath) as { basics?: { name?: string } };
  if (!resume.basics?.name) problems.push('public/resume.json: missing basics.name');
} else {
  problems.push('public/resume.json: missing');
}

if (problems.length) {
  console.error('Synced content check failed:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Synced content OK');
