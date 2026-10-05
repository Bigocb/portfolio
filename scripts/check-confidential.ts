import { readFileSync, existsSync } from 'fs';
import { globSync } from 'glob';
import { resolve } from 'path';

const DENYLIST_FILE = resolve('scripts', 'denylist.txt');
const CONTENT_DIR = resolve('src', 'content', 'projects');

interface FrontmatterData {
  confidential_review?: boolean;
}

// Read denylist
function loadDenylist(): string[] {
  if (!existsSync(DENYLIST_FILE)) {
    console.warn(`Denylist not found at ${DENYLIST_FILE}`);
    return [];
  }
  const content = readFileSync(DENYLIST_FILE, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

// Extract frontmatter
function extractFrontmatter(content: string): FrontmatterData {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  const confidentialMatch = frontmatter.match(/confidential_review:\s*(true|false)/);
  return {
    confidential_review: confidentialMatch ? confidentialMatch[1] === 'true' : false,
  };
}

// Main checks
async function runChecks(): Promise<boolean> {
  let hasErrors = false;
  const denylist = loadDenylist();

  console.log('🔍 Running confidentiality checks...\n');

  // Check 1: Confidential review flag
  const projectFiles = globSync('**/*.md', { cwd: CONTENT_DIR });
  const confidentialProjects = [];

  for (const file of projectFiles) {
    const filePath = resolve(CONTENT_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const frontmatter = extractFrontmatter(content);

    if (frontmatter.confidential_review) {
      confidentialProjects.push(file);
    }
  }

  if (confidentialProjects.length > 0) {
    console.log('⚠️  Confidential projects requiring review:');
    confidentialProjects.forEach(file => console.log(`   - ${file}`));

    if (process.env.ALLOW_UNREVIEWED !== '1' && process.env.CI) {
      console.error(
        '\n❌ Production build blocked: unreviewed confidential content.\n' +
        '   Set ALLOW_UNREVIEWED=1 to allow (dev only)\n'
      );
      hasErrors = true;
    } else {
      console.log('   ✓ Allowed in development (ALLOW_UNREVIEWED=1)\n');
    }
  } else {
    console.log('✓ No confidential projects flagged for review\n');
  }

  // Check 2: Denylist terms
  if (denylist.length > 0) {
    console.log(`Checking for ${denylist.length} denied terms...\n`);
    const allContent = projectFiles
      .map(file => {
        const filePath = resolve(CONTENT_DIR, file);
        return readFileSync(filePath, 'utf-8');
      })
      .join('\n');

    const foundTerms = new Map<string, string[]>();
    for (const term of denylist) {
      const regex = new RegExp(term, 'gi');
      const matches = allContent.match(regex);
      if (matches) {
        const projects = projectFiles.filter(file => {
          const filePath = resolve(CONTENT_DIR, file);
          const content = readFileSync(filePath, 'utf-8');
          return new RegExp(term, 'i').test(content);
        });
        foundTerms.set(term, projects);
      }
    }

    if (foundTerms.size > 0) {
      console.error('❌ Denied terms found in content:');
      for (const [term, projects] of foundTerms) {
        console.error(`   "${term}" in: ${projects.join(', ')}`);
      }
      hasErrors = true;
    } else {
      console.log('✓ No denied terms found\n');
    }
  }

  // Check 3: Em-dashes
  console.log('Checking for em-dashes (—)...');
  let emDashCount = 0;
  for (const file of projectFiles) {
    const filePath = resolve(CONTENT_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const matches = content.match(/—/g);
    if (matches) {
      emDashCount += matches.length;
      console.error(`   ❌ ${file}: ${matches.length} em-dash(es)`);
    }
  }

  if (emDashCount > 0) {
    console.error(`\n❌ Found ${emDashCount} em-dash(es). Use -- instead.\n`);
    hasErrors = true;
  } else {
    console.log('✓ No em-dashes found\n');
  }

  return !hasErrors;
}

// Run
runChecks()
  .then(success => {
    if (!success) {
      console.error('\n❌ Confidentiality checks failed');
      process.exit(1);
    }
    console.log('✅ All checks passed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error running checks:', err);
    process.exit(1);
  });
