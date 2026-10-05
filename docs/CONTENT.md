# Adding Content

This guide explains how to add projects, blog posts, and update site data.

## Quick Start: Add a Project

1. **Create a Markdown file** in `src/content/projects/`
   ```bash
   cp src/content/projects/conclave.md src/content/projects/your-project.md
   ```

2. **Edit the frontmatter** (the YAML at the top):
   ```yaml
   ---
   title: "Your Project Name"
   summary: "One sentence describing the project (max 200 chars)"
   status: active          # or: maintained, archived, concept
   featured: false         # set to true to show on home page (max 3)
   year: 2024             # or "2023-2024" for date ranges
   role: "Your role"      # e.g., "Sole author", "Lead engineer", "Contributor"
   stack:
     - TypeScript
     - React
     - AWS
   repo: "https://github.com/user/repo"  # optional
   demo: "https://example.com"           # optional
   order: 1               # sort order on projects page (lower = first)
   confidential_review: false # set to true if it contains employer content
   ---
   ```

3. **Write the project writeup** following this structure:

   ```markdown
   ## Problem
   
   What is it and why does it exist? 2-4 sentences about the problem it solves.
   
   ## Approach
   
   The key design decisions and alternatives you considered.
   
   ## Architecture
   
   A diagram (ASCII, Mermaid, or linked image) plus prose explaining the system.
   
   ## What was hard
   
   One or two real problems you encountered and how you solved them.
   
   ## Results / what I'd change
   
   Honest outcomes. What worked? What would you do differently? What did you learn?
   
   ## Links
   
   - [Repository](link)
   - [Live demo](link)
   ```

4. **Run locally to preview**:
   ```bash
   npm run dev
   # Opens http://localhost:3000, navigate to /projects/your-project
   ```

5. **Check no errors**:
   ```bash
   npm run check   # type check
   npm run build   # full build
   npm run lint    # code style
   ```

6. **Commit and push**:
   ```bash
   git add src/content/projects/your-project.md
   git commit -m "feat: add project writeup for Your Project Name"
   git push
   ```

   GitHub Actions will automatically:
   - Run all checks
   - Build the site
   - Deploy to production

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

If a project involves **employer work** (Wells Fargo):

1. Use **generic language**: "enterprise platform", not product names
2. Never include: internal diagrams, system names, metrics
3. Set `confidential_review: true` in frontmatter
4. Owner must review before production build proceeds

The build will fail if confidential items haven't been cleared:
```bash
⚠️  Confidential projects requiring review:
   - src/content/projects/mcp-gateway.md
❌ Production build blocked: unreviewed confidential content.
```

To preview locally: `ALLOW_UNREVIEWED=1 npm run build`

## Automation

Once you push to `main`, GitHub Actions:
1. ✅ Runs linting
2. ✅ Type checks all content
3. ✅ Builds the static site
4. ✅ Checks all links work
5. ✅ Runs accessibility audits
6. ✅ Checks for blocked terms (denylist)
7. ✅ Checks for em-dashes
8. ✅ Deploys to production (if all checks pass)

No manual deploy needed.

## Common Tasks

### Change project order on /projects page
Edit `order` field (lower = first). Projects sort by order value.

### Feature a project on home page
Set `featured: true` in frontmatter (max 3 featured).

### Archive an old project
Change `status: archived` — it still shows in /projects but with a different badge.

### Update about section
Edit TODO placeholders in `src/pages/about.astro`.

### Add a resume PDF
Upload files to:
- `public/resume/Robin_Cloutier_Resume.pdf`
- `public/resume/Robin_Cloutier_Executive_Summary.pdf`

These will be downloadable from `/resume`.

## Troubleshooting

### Build fails with "Denied term found"
One of the denylist terms appeared in your content. Remove it or update `scripts/denylist.txt`.

### Links to projects broken
Use internal paths: `/projects/your-project`, not `http://example.com/projects/...`

### Project doesn't show up
- Check frontmatter YAML syntax (no trailing colons)
- Verify filename matches `src/content/projects/your-project.md`
- Run `npm run build` locally to see errors

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
