import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { globSync } from 'glob';

interface Link {
  href: string;
  file: string;
  line: number;
}

const DIST_DIR = resolve('dist');
const INTERNAL_LINK_REGEX = /href=["']([^"']+)["']/g;

function getAllHtmlFiles(): string[] {
  return globSync('**/*.html', { cwd: DIST_DIR });
}

function extractLinks(htmlContent: string, filePath: string): Link[] {
  const links: Link[] = [];
  let match;
  let lineNumber = 1;

  // Reset regex
  INTERNAL_LINK_REGEX.lastIndex = 0;

  while ((match = INTERNAL_LINK_REGEX.exec(htmlContent)) !== null) {
    const href = match[1];

    // Count line breaks up to this point to get line number
    lineNumber = htmlContent.substring(0, match.index).split('\n').length;

    // Only check internal links (not http/https/mailto/etc)
    if (!href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('#')) {
      links.push({ href, file: filePath, line: lineNumber });
    }
  }

  return links;
}

function resolveLink(link: string, fromFile: string): string {
  // Remove query strings and fragments
  const basePath = link.split('?')[0].split('#')[0];

  if (basePath.startsWith('/')) {
    // Absolute path from root
    return join(DIST_DIR, basePath);
  } else {
    // Relative path
    const dir = dirname(fromFile);
    return resolve(dir, basePath);
  }
}

function linkExists(resolvedPath: string): boolean {
  // Check if it's a directory with index.html
  if (existsSync(resolve(resolvedPath, 'index.html'))) {
    return true;
  }

  // Check if file exists
  if (existsSync(resolvedPath)) {
    return true;
  }

  return false;
}

async function checkLinks(): Promise<boolean> {
  console.log('🔗 Checking links...\n');

  const htmlFiles = getAllHtmlFiles();
  const brokenLinks: Array<{ link: Link; target: string }> = [];

  for (const file of htmlFiles) {
    const filePath = resolve(DIST_DIR, file);
    const content = readFileSync(filePath, 'utf-8');
    const links = extractLinks(content, file);

    for (const link of links) {
      const resolvedPath = resolveLink(link.href, filePath);

      if (!linkExists(resolvedPath)) {
        brokenLinks.push({ link, target: resolvedPath });
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.error('❌ Broken links found:\n');
    brokenLinks.forEach(({ link, target }) => {
      console.error(
        `  ${link.file}:${link.line}\n` +
        `    href="${link.href}"\n` +
        `    resolves to: ${target}\n`
      );
    });
    return false;
  } else {
    console.log(`✓ All links OK (checked ${htmlFiles.length} files)\n`);
    return true;
  }
}

checkLinks()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error checking links:', err);
    process.exit(1);
  });
