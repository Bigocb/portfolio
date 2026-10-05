# Content TODO

This file lists all placeholders and decisions that require owner input before the site is production-ready.

## Personal information

- [ ] **About page** (`src/pages/about.astro`)
  - [ ] Personal bio (2-3 paragraphs, human and personal)
  - [ ] How you work (working style, values, approach)
  - [ ] What you do outside of code

- [ ] **Contact page** (`src/content/data/links.json`)
  - [ ] Verify email address is correct
  - [ ] Verify GitHub URL
  - [ ] Update LinkedIn URL

## Work history and skills

- [ ] **Experience data** (`src/content/data/experience.json`)
  - [ ] Verify work history entries
  - [ ] Update company names (currently generic)
  - [ ] Verify dates and job titles
  - [ ] Add any missing positions

- [ ] **Resume page** (`src/pages/resume.astro`)
  - [ ] Create or provide resume content
  - [ ] Upload `public/resume/Robin_Cloutier_Resume.pdf`
  - [ ] Upload `public/resume/Robin_Cloutier_Executive_Summary.pdf`

- [ ] **Resume source** (for HTML rendering)
  - [ ] Create `content/source/resume.md` with work history

## Metrics and stats

- [ ] **Impact stats** (`src/content/data/stats.json`)
  - [ ] Verify the three verified metrics are accurate
  - [ ] Add a fourth verified metric (currently placeholder)
  - [ ] Update footnote for "agents" metric to actual date

## Hosting and infrastructure

- [ ] **Colophon page** (`src/pages/colophon.astro`)
  - [ ] Describe where the site runs (home lab, VM, etc.)
  - [ ] Add link to public source repo or note if private

## Project writeups

Each of these 5 seed projects needs detailed content:

- [ ] **Conclave** (`src/content/projects/conclave.md`)
  - [ ] Problem section (what and why)
  - [ ] Approach (design decisions, alternatives)
  - [ ] Architecture (diagram + prose)
  - [ ] What was hard (real problems and solutions)
  - [ ] Results and what you'd change

- [ ] **stcommand** (`src/content/projects/stcommand.md`)
  - Same sections as Conclave

- [ ] **HUNTLOG** (`src/content/projects/huntlog.md`)
  - Same sections as Conclave
  - [ ] Add demo link if available

- [ ] **MicroK8s home lab** (`src/content/projects/microk8s-homelab.md`)
  - Same sections as Conclave

- [ ] **MCP gateway** (`src/content/projects/mcp-gateway.md`)
  - [ ] Review confidential content before clearing `confidential_review: true`
  - Same sections as Conclave

## Domain and deployment

- [ ] **Domain name**
  - [ ] Update site URL in `astro.config.mjs` from `https://example.com`

- [ ] **Deployment method** (choose one)
  - [ ] Option A: SSH + Docker Compose (update deploy workflow)
  - [ ] Option B: Image tag bump in deployment repo

- [ ] **GitHub Actions secrets** (if deploying)
  - [ ] Set up `DOCKER_REGISTRY_PASSWORD` if using GHCR
  - [ ] Set up SSH key if using SSH deploy
  - [ ] Set up `SITE_DOMAIN` env var in deploy config

## Optional: Future features

These are out of scope for v1 but noted for later:

- [ ] Writing/blog posts collection (framework ready, content needed)
- [ ] Privacy-friendly analytics
- [ ] More detailed project filtering
- [ ] Speaking engagements or publications
- [ ] Headshot/avatar on about page

## Wells Fargo confidentiality

- [ ] Review all Wells Fargo mentions for generic language
- [ ] Clear `confidential_review: true` flags on projects after review
- [ ] Verify no internal product/system names in content
- [ ] Check denylist in `scripts/denylist.txt` for blocked terms

## Publishing checklist

- [ ] `npm run build` passes
- [ ] `npm run check` passes (0 errors, 0 warnings)
- [ ] `npm run test` passes
- [ ] Navigation links all work
- [ ] Dark mode works
- [ ] All TODO placeholders filled
- [ ] Domain is set up and DNS configured
- [ ] TLS certificate ready (Caddy handles auto-renewal)
- [ ] Server is running and responding on production domain

## Questions?

Refer to `PORTFOLIO_PLAN.md` section 6 (Content model) for schema details and data structure.
