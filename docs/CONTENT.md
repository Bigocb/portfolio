# Adding Content

This guide explains how to add projects, blog posts, and update site data.

## Quick Start: Add a Project

Projects are driven by the HUB experience vault, not hand-authored frontmatter.

1. **Publish the project from the HUB.** Mark a vault project public with a slug:

   ```bash
   python -m job_hunt.cli project set-public <id> --visibility public --slug my-project --status active
   python -m job_hunt.cli publish export --out ../portfolio
   ```

   This writes the metadata into `src/content/synced/projects.json` and generates
   the route. See "Editing Data Files" below.

2. **Add an optional prose writeup.** Create `src/content/projects/<slug>.md` with a
   title and body; the exporter owns this file once a `writings` row exists (Phase 2).
   Without a writeup, the project page shows the role's public bullets:

   ```markdown
   ---
   title: "My Project"
   ---

   ## Problem
   ...

   ## Approach
   ...

   ## What was hard
   ...

   ## Results / what I'd change
   ...
   ```

3. **Preview locally**: `npm run dev`, then open `/projects/<slug>`.

4. **Check**: `npm run check && npm run build && npm run lint`.

5. **Commit**: `git add src/content/projects/<slug>.md && git commit -m "docs: add writeup for <slug>"`.

## Editing Data Files

### Generated vs. hand-authored content

**Machine-owned (do NOT hand-edit; regenerate from the HUB):**
- `src/content/synced/**` (identity, experience, stats, capabilities, projects, manifest)
- `public/resume.json`, `public/llms.txt`
- `public/robots.txt`

These are written by `job_hunt publish export`. Regenerate with:

```bash
python -m job_hunt.cli publish export --out ../portfolio
```

**Human-owned:** `src/content/writing/*.md`, `content/source/**`, `docs/**`, and all
pages/components not listed above.

Project metadata (summary, status, featured, stack, repo, ...) lives in
`src/content/synced/projects.json`. The markdown files under `src/content/projects/`
carry only a title and the prose body; project frontmatter is not the metadata source.

### Update stats (`src/content/synced/stats.json`)

Do not edit by hand. Stats are `claims` in the HUB vault; each needs evidence and an
as-of date to be exportable. Manage with:

```bash
python -m job_hunt.cli claim add --key years_production --value "15+" \
  --label "years of production engineering" --evidence "<url>" --as-of 2026-01-01 --visibility public
```

### Update capabilities (`src/content/synced/capabilities.json`)

Do not edit by hand. Capabilities are derived from `tech_used` on public projects.

### Update experience (`src/content/synced/experience.json`)

Do not edit by hand. Managed as experiences in the HUB vault; set visibility and a
public alias with `job_hunt experience set-visibility`.

### Update contact links

Do not edit by hand. Managed with `job_hunt identity set`.

## Adding Blog Posts (Optional)

Blog collection is set up but not surfaced in v1. To enable:

1. **Create posts** in `src/content/writing/`:
   ```yaml
   ---
   title: "Post Title"
   summary: "Short description"
   published: 2024-01-15
   updated: 2024-01-20  # optional
   ---
   
   Your post content here...
   ```

2. **Create /writing page** (link to `src/pages/writing.astro`):
   ```astro
   ---
   import { getCollection } from 'astro:content';
   const posts = await getCollection('writing');
   ---
   ```

## Writing Guidelines

### Style
- **Plain, direct, technical** — no marketing fluff
- **No em-dashes** — use `--` instead
- **Be honest** — describe real problems and trade-offs
- **Avoid overclaiming** — use "led", "built", "contributed" accurately

### Structure for project writeups
1. **Problem** (why it exists, what it solves)
2. **Approach** (design decisions, what you tried)
3. **Architecture** (how it works, diagram)
4. **What was hard** (real challenges, how you solved them)
5. **Results** (what happened, what you'd change)

### Code examples
Use backtick fences with language:
````markdown
```typescript
const result = await doSomething();
```
````

### Links
- Internal: `/projects`, `/about`
- External: `https://example.com`

## Confidentiality

Employer-confidentiality is enforced in the HUB, not in this repo:

1. The vault `visibility` gate — only `public` rows are exported.
2. `public_alias` — a role's real company (e.g. Wells Fargo) is replaced by an
   alias before it can reach the snapshot.
3. The denylist (`data/denylist.txt` in the HUB, mirrored here) — `job_hunt
   publish check` fails closed if a blocked term appears in the snapshot.

Use generic language ("enterprise platform", not product names) in writeups, and
never enable a project for publishing without checking with the alias rules in
mind. There is no per-file `confidential_review` flag anymore; the publish gate is
the single control.

## Automation

Once you push to `main`, GitHub Actions:
1. ✅ Runs linting
2. ✅ Type checks all content
3. ✅ Builds the static site
4. ✅ Checks all links work
5. ✅ Runs accessibility audits
6. ✅ Validates the synced snapshot (`scripts/check-synced.ts`)
7. ✅ Deploys to production (if all checks pass)

No manual deploy needed.

## Common Tasks

### Change project order on /projects page
Set `sort_order` on the vault project (`job_hunt project set-public <id> --order N`).
Lower = first.

### Feature a project on home page
`job_hunt project set-public <id> --featured` (max 3 featured; the publish check
fails above 3).

### Archive an old project
`job_hunt project set-public <id> --status archived` — it still shows, with a badge.

### Update about section
Edit `src/pages/about.astro`.

### Add a resume PDF
Upload files to `public/resume/`. The generated `.docx` (Phase 2) is written by the
exporter; PDFs, if used, are hand-placed.

## Troubleshooting

### Build fails with "Denied term found"
A denylist term appeared in content. Remove it or update `scripts/denylist.txt`.

### Links to projects broken
Project routes come from `synced/projects.json`; a missing route means the project
has no `public_slug`, or the export drifted. Re-run `job_hunt publish export`.

### Project doesn't show up
- Confirm it is `visibility: public` with a `public_slug` in the vault.
- Re-run `job_hunt publish export --out ../portfolio`.
- Run `npm run build` locally to see errors.

### Image won't display
- Place image in `public/images/`
- Reference as `/images/filename.png` in Markdown

## Preview Before Publishing

Always test locally:

```bash
npm run dev
# Browser opens to http://localhost:3000
# Navigate to your project
# Check links, images, formatting
```

Then run full checks:

```bash
npm run build      # must succeed
npm run lint       # code style
npm run check      # types
npm run test       # accessibility + smoke tests
```

All must pass before pushing to main.
