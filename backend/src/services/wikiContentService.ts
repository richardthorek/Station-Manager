/**
 * In-app wiki content service.
 *
 * Reads markdown directly from docs/wiki/{user-guide,platform-admin} at
 * runtime — no build-time copy into the frontend bundle, no CMS. Editing a
 * .md file in the repo and shipping it is the whole authoring workflow. The
 * nav structure (sections + page order) is derived from the section's
 * README.md table of contents rather than duplicated in code, so adding a
 * page only means: write the .md file, link it from README.md.
 *
 * Deliberately scoped to two directories only: `user-guide` (everyone) and
 * `platform-admin` (gated separately in routes/wiki.ts). `docs/wiki/developer`
 * is never read here — that's internal/technical documentation and must never
 * be reachable through this service.
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export type WikiSection = 'user-guide' | 'platform-admin';

export interface WikiManifestPage {
  slug: string;
  title: string;
  description: string;
}

export interface WikiManifestSection {
  heading: string;
  pages: WikiManifestPage[];
}

export interface WikiManifest {
  sections: WikiManifestSection[];
}

export interface WikiPage {
  slug: string;
  title: string;
  markdown: string;
}

// backend/src/services -> repo root is three levels up. Holds for both
// ts-node (backend/src/services) and the compiled dist (backend/dist/services),
// and matches the deploy package layout (deploy/backend/dist + deploy/docs/wiki).
const REPO_ROOT = path.resolve(__dirname, '../../../');

const SECTION_DIRS: Record<WikiSection, string> = {
  'user-guide': path.join(REPO_ROOT, 'docs', 'wiki', 'user-guide'),
  'platform-admin': path.join(REPO_ROOT, 'docs', 'wiki', 'platform-admin'),
};

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const IMAGE_FILENAME_PATTERN = /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|gif|svg|webp)$/;

function sectionDir(section: WikiSection): string {
  return SECTION_DIRS[section];
}

function readReadme(section: WikiSection): string | null {
  const readmePath = path.join(sectionDir(section), 'README.md');
  try {
    return fs.readFileSync(readmePath, 'utf-8');
  } catch (err) {
    logger.warn('Wiki README not found', { section, err: err instanceof Error ? err.message : err });
    return null;
  }
}

/**
 * Parses `| [Title](slug.md) | Description |` rows grouped under `###`
 * headings out of a wiki section's README.md. Rows without a markdown link
 * in the first cell (e.g. the "Plans at a glance" table) are skipped.
 */
function parseManifest(readme: string): WikiManifest {
  const sections: WikiManifestSection[] = [];
  let current: WikiManifestSection | null = null;

  const linkRowPattern = /^\|\s*\[([^\]]+)\]\(([a-zA-Z0-9-]+)\.md\)\s*\|\s*(.*?)\s*\|$/;

  for (const line of readme.split('\n')) {
    const headingMatch = /^###\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), pages: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const rowMatch = linkRowPattern.exec(line.trim());
    if (!rowMatch) continue;
    const [, title, slug, description] = rowMatch;
    current.pages.push({ slug, title, description });
  }

  return { sections: sections.filter((s) => s.pages.length > 0) };
}

export function getWikiManifest(section: WikiSection): WikiManifest {
  const readme = readReadme(section);
  if (!readme) return { sections: [] };
  return parseManifest(readme);
}

function firstHeading(markdown: string): string | null {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : null;
}

/** Every slug this section's manifest links to, plus 'readme' for the landing page. */
function knownSlugs(section: WikiSection): Set<string> {
  const manifest = getWikiManifest(section);
  const slugs = new Set<string>(['readme']);
  for (const s of manifest.sections) {
    for (const p of s.pages) slugs.add(p.slug);
  }
  return slugs;
}

export function getWikiPage(section: WikiSection, slug: string): WikiPage | null {
  if (!SLUG_PATTERN.test(slug)) return null;
  if (!knownSlugs(section).has(slug)) return null;

  const filename = slug === 'readme' ? 'README.md' : `${slug}.md`;
  const filePath = path.join(sectionDir(section), filename);

  // Defence in depth against path traversal even though the slug pattern
  // and known-slugs whitelist already rule it out.
  if (!filePath.startsWith(sectionDir(section))) return null;

  try {
    const markdown = fs.readFileSync(filePath, 'utf-8');
    return { slug, title: firstHeading(markdown) || slug, markdown };
  } catch (err) {
    logger.warn('Wiki page not found', { section, slug, err: err instanceof Error ? err.message : err });
    return null;
  }
}

/** Every real content page in manifest order (excludes 'readme' — that's the nav source, not content). Used to build the AI search corpus. */
export function getAllWikiPages(section: WikiSection): WikiPage[] {
  const manifest = getWikiManifest(section);
  const pages: WikiPage[] = [];
  for (const s of manifest.sections) {
    for (const p of s.pages) {
      const page = getWikiPage(section, p.slug);
      if (page) pages.push(page);
    }
  }
  return pages;
}

export function getWikiImagePath(section: WikiSection, filename: string): string | null {
  if (!IMAGE_FILENAME_PATTERN.test(filename)) return null;
  const imagesDir = path.join(sectionDir(section), 'images');
  const filePath = path.join(imagesDir, filename);
  if (!filePath.startsWith(imagesDir)) return null;
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}
