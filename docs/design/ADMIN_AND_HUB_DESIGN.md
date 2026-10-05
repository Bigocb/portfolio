# Portfolio admin layer and the "system of me" hub

Status: design proposal for discussion (2026-10-05)
Scope: planning only. No code changes are implied by this document.

Repos in play:

- `bigocb/portfolio` (this repo): Astro 5 static site, Docker + Caddy, hardened CI (denylist, confidential review gate, link check, a11y).
- `bigocb/job_hunt`: FastAPI + React, SQLite, JWT auth, LangChain/LangGraph RAG. Contains the **experience vault**.
- `bigocb/tapestry`: memory capture and narrative platform (FastAPI, Postgres + pgvector on Render, agent pipeline, story generation).
- `bigocb/sage`: personal analytics and recommendation engine (FastAPI, Postgres/Timescale, Claude reasoning, voice first).

---

## 1. The key observation

The "core data store about me" already exists. It is the experience vault inside job_hunt
(`src/job_hunt/experience.py`):

| Table             | What it holds                                                         |
| ----------------- | --------------------------------------------------------------------- |
| `experiences`     | Company, title, dates, team size, scale, methodology, notes           |
| `projects`        | Per-experience projects with description, impact, `visibility` flag  |
| `tech_used`       | Technology per project with category and proficiency                  |
| `bullet_variants` | Same fact rendered for an audience (`platform`, `ai`, ...) and length |
| `stories`         | STAR stories with question tags                                       |

Plus `data/users/{uid}/profile.json` (identity, summary, target titles, skills with weights,
work preferences) and `docs/study-plans/*` (what you are learning right now).

`bullet_variants` is the most important idea in there: **one underlying fact, many renderings**.
That is exactly the pattern a portfolio needs. The portfolio is just another audience.

The vault also already has `projects.visibility` (default `internal`). The publishing model
below is an extension of that column, not a new concept.

So the recommendation is: **do not build a new hub first**. Promote the vault into the hub by
giving it a publish boundary and a second consumer. Extract it into its own service only when a
third system (Tapestry or Sage) actually needs it. Platforms built before their second consumer
tend to get the schema wrong.

---

## 2. Target architecture

```
                 +----------------------------------------------+
                 |             HUB  (today: job_hunt API)        |
                 |                                              |
   resume.docx --|-> profile import                              |
   stories    ---|-> story parser -> bullets / STAR               |
   admin UI   ---|-> experiences, projects, tech, claims,         |
                 |   renderings, visibility, aliases             |
                 |                                              |
                 |   PUBLISH BOUNDARY (visibility == public,     |
                 |   alias substitution, denylist, provenance)   |
                 +------+-----------------+-----------------+---+
                        |                 |                 |
                   snapshot JSON      resume.pdf/.docx    read-only
                   (PR to portfolio)  (versioned)        MCP / JSON
                        |                 |                 |
                        v                 v                 v
                 +-------------+   +-------------+   +--------------+
                 |  portfolio  |   | /resume     |   | agents,      |
                 |  (Astro,    |   | downloads   |   | recruiters'  |
                 |   static)   |   |             |   | tooling      |
                 +-------------+   +-------------+   +--------------+

   Branches off the same core, later:
   - job_hunt matcher / generator (already a consumer of the vault)
   - Tapestry: memory -> narrative -> writing draft
   - Sage: "now" signals (private by default; opt-in only)
```

Principles:

1. **The portfolio stays static.** The hardening work (Caddy, denylist, confidential gate) is
   worth keeping. No database, no auth, no admin routes on the public site.
2. **Push, not pull.** The hub pushes a snapshot into the portfolio repo as a pull request.
   The portfolio build never calls a live API. Builds are reproducible, work offline, and the
   home-lab API is never exposed to GitHub Actions.
3. **The PR is the review gate.** You read the diff of what is about to become public, CI runs
   the denylist and confidential checks, and merge equals deploy. This is the single most
   important control given the employer-confidentiality constraint.
4. **Visibility is enforced server side at the publish boundary**, never by the consumer.
   A leaked export token can only ever produce public data.
5. **One fact, many renderings.** Numbers, bullets, and summaries are projections of a stored
   fact with provenance. The site's `verified` flag becomes computed, not hand-set.

---

## 3. Data model additions to the hub

Additive changes to the existing SQLite schema. All are nullable or defaulted so nothing
in job_hunt breaks.

```sql
-- Visibility becomes a three-level enum used everywhere, not just on projects.
--   private : never leaves the hub
--   resume  : may appear in generated resumes / outreach (today's "internal" behaviour)
--   public  : may appear on the portfolio and public endpoints
ALTER TABLE experiences    ADD COLUMN visibility   TEXT NOT NULL DEFAULT 'resume';
ALTER TABLE experiences    ADD COLUMN public_alias TEXT;         -- e.g. "Large Financial Institution"
ALTER TABLE experiences    ADD COLUMN public_note  TEXT;         -- one-line public description
ALTER TABLE projects       ADD COLUMN public_slug  TEXT;         -- -> /projects/<slug>
ALTER TABLE projects       ADD COLUMN featured     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects       ADD COLUMN sort_order   INTEGER;
ALTER TABLE projects       ADD COLUMN repo_url     TEXT;
ALTER TABLE projects       ADD COLUMN demo_url     TEXT;
ALTER TABLE projects       ADD COLUMN status       TEXT;         -- active|maintained|archived|concept
ALTER TABLE bullet_variants ADD COLUMN visibility  TEXT NOT NULL DEFAULT 'resume';

-- Claims: every number that appears anywhere, with its evidence.
CREATE TABLE claims (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    key         TEXT NOT NULL,            -- "years_production", "agents_on_mcp_gateway"
    value       TEXT NOT NULL,            -- "15+", "6", "~1M"
    label       TEXT NOT NULL,            -- public wording
    evidence    TEXT,                     -- URL, commit, ticket, or free text
    as_of       TEXT,                     -- date the value was true
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    visibility  TEXT NOT NULL DEFAULT 'private',
    created_at  TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- verified := evidence IS NOT NULL AND as_of IS NOT NULL   (computed at export)

-- Long-form writing: project writeups and posts, drafted from stories.
CREATE TABLE writings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    kind        TEXT NOT NULL,            -- project_writeup | post | now
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    slug        TEXT NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT,
    body_md     TEXT NOT NULL,
    source_story_ids TEXT,                -- JSON array, provenance back to STAR stories
    visibility  TEXT NOT NULL DEFAULT 'private',
    published_at TEXT,
    created_at  TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- Identity block for the site header, hero, contact, availability.
CREATE TABLE identity (
    user_id       INTEGER PRIMARY KEY,
    display_name  TEXT, tagline TEXT, pitch TEXT,
    email TEXT, github TEXT, linkedin TEXT,
    availability  TEXT,                   -- open | selective | not_looking
    availability_note TEXT,
    updated_at    TEXT NOT NULL
);

-- Publish log: what was exported, when, to where.
CREATE TABLE publishes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    target      TEXT NOT NULL,            -- portfolio | resume | mcp
    snapshot_sha256 TEXT NOT NULL,
    pr_url      TEXT,
    created_at  TEXT NOT NULL
);
```

Mapping to what the portfolio consumes today:

| Portfolio file today                 | Hub source after                                      |
| ------------------------------------ | ----------------------------------------------------- |
| `src/content/data/experience.json`   | `experiences` where visibility=public, alias applied  |
| `src/content/data/stats.json`        | `claims` where visibility=public, verified computed   |
| `src/content/data/capabilities.json` | `tech_used` grouped by category + manual overrides    |
| `src/content/data/links.json`        | `identity`                                            |
| `src/content/projects/*.md`          | `projects` (frontmatter) + `writings` (body)          |
| hero copy in `index.astro`           | `identity.tagline`, `identity.pitch`                  |

---

## 4. The publish boundary (hub side)

New module `job_hunt/publish.py` plus route `/api/publish` and CLI `job_hunt publish`.

Export pipeline, in order:

1. **Select**: rows with `visibility = 'public'` only. Joins never widen the set (a public
   project under a private experience is exported with the experience alias, never the name).
2. **Redact**: substitute `public_alias` for `company` wherever an alias exists. Strip
   `reporting_to`, `business_unit`, `notes`, phone, and anything not on the export allowlist.
   The allowlist is explicit per table; new columns are private until added.
3. **Check**: run the same denylist used by the portfolio (`scripts/denylist.txt` copied or
   shared) and the em-dash rule over the rendered output. Fail closed.
4. **Render**: write the snapshot:

   ```
   export/
     identity.json
     experience.json
     stats.json
     capabilities.json
     projects/<slug>.md          (frontmatter from projects, body from writings)
     resume.json                 (JSON Resume schema, for machines)
     manifest.json               (sha256 per file, hub commit, timestamp)
   ```

5. **Deliver**: open a PR against `bigocb/portfolio` using a fine-grained GitHub token scoped to
   that repo (`contents:write`, `pull_requests:write`). Branch `hub/publish-<timestamp>`.
   PR body lists the diff summary and the manifest. Record a row in `publishes`.

The portfolio CI already runs denylist + confidential + build + a11y on PRs. Merge to `main`
deploys. Nothing about the portfolio pipeline changes except the source of its data files.

Delivery alternatives considered:

- *Portfolio pulls from the hub API at build time* (Astro Content Layer custom loader). Clean,
  but requires exposing the home-lab API to GitHub runners (tunnel or self-hosted runner) and
  makes builds depend on hub uptime. Rejected for now; easy to add later as a dev-mode loader.
- *Hub pushes directly to `main`*. Loses the review gate. Rejected.
- *Git-based CMS (Decap, Keystatic) editing markdown in the repo*. Fast to set up and gives an
  editor UI, but it does not know about the vault, so it would create a second source of truth
  for experience and stats. Could still be used for one-off pages (about, colophon).

---

## 5. Admin UI (inside the job_hunt web app)

A new top-level section, "Portfolio", in `web/src/pages/`. Reuses existing auth, API client,
and the Resume page's experience browser. Sections:

| Section       | What you do there                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Overview      | Last publish, pending changes since (diff count per file), availability toggle, link to live site and open PR        |
| Identity      | Name, tagline, pitch, links, availability status and note                                                            |
| Experience    | Table of experiences with visibility selector, public alias, public note. Warn when public and alias is empty       |
| Projects      | Vault projects: visibility, slug, status, featured (max 3 enforced), order, repo/demo URLs. Writeup status badge     |
| Writeups      | Markdown editor per project. "Draft from stories" button: LLM turns linked STAR stories into Problem / Approach / Architecture / What was hard / Results sections. Shows provenance (which stories fed which section) |
| Claims        | Value, label, evidence, as-of date, visibility. Verified badge is computed. Unverified public claims block publish   |
| Capabilities  | Auto-grouped from `tech_used` by category with proficiency. Manual title/description override per group              |
| Preview       | Renders the export in a plain template so you see exactly what will leave the hub, with redactions highlighted       |
| Publish       | Runs checks, shows the diff against the last snapshot, opens the PR. Disabled while a hub-authored PR is still open  |

Workflow for the common case ("I finished something at work and want it on the site"):

1. Tell the story in plain text (existing `/api/experience/parse-story`). Bullets land in the vault.
2. In Projects, flip the project to `public`, set slug and status.
3. In Writeups, draft from stories, edit, save.
4. In Claims, add the number with its evidence.
5. Publish. Review the PR on your phone. Merge.

---

## 6. Portfolio-side changes

Small, and all additive:

- Move consumed data to `src/content/synced/` (committed, hub-authored). Keep `src/content/data/`
  for hand-maintained files until each one has moved.
- Replace `z.any()` on the `data` collection with real zod schemas for identity, experience,
  stats, capabilities. Astro's build then type-checks hub output.
- `manifest.json` is read at build and surfaced on `/colophon` ("content last synced from hub
  at ..., snapshot abc123"). Cheap provenance, and a nice on-brand detail.
- New `/resume.json` (JSON Resume), `/llms.txt`, and `schema.org/Person` JSON-LD in `Base.astro`.
  Zero runtime cost, makes the site legible to agents and ATS tooling.
- Optional `/now` page from `writings.kind = 'now'` plus `identity.availability`.

---

## 7. Phased plan

Everything through Phase 3 is job_hunt plus a publish boundary plus this repo. No new
service, no Postgres, no Tapestry or Sage involvement. The three headline ideas (claims with
provenance, agent-readable output, tailored recruiter pages) are all inside that envelope.

| Phase | Outcome                                                                                   | Effort   |
| ----- | ----------------------------------------------------------------------------------------- | -------- |
| 0     | **Publish boundary and claims.** Hub: visibility columns, `claims` (with computed `verified`, export fails on unverified public claims), `identity`, `publish export` CLI writing the snapshot locally including `resume.json` and `llms.txt`. Portfolio: `synced/` collection with zod schemas, pages read from it, serves `/resume.json` and `/llms.txt`, JSON-LD on every page. Snapshot committed by hand. | 1 weekend |
| 1     | **Admin UI and PR delivery.** Hub: `/api/publish` opens the PR; publish log. Admin UI: Overview, Identity, Experience, Projects, Claims, Capabilities, Preview, Publish. | 1 to 2 weeks |
| 2     | **Writeups and tailored pages.** Story-to-draft writeups; `writings` export to `projects/*.md`; resume `.docx` built at publish and attached. Per-application `/for/<token>` pages exported alongside, `noindex`. Caddy log tail posts view events back to job_hunt. | 1 to 2 weeks |
| 3     | **Read-only MCP server** in job_hunt over the last published snapshot (not the live vault). Tools: `search_bullets`, `get_experience`, `get_project`, `get_claims`. | 1 week   |
| 4     | **Extract the hub** into its own service (Postgres, Render or home lab) once Tapestry or Sage becomes a consumer. job_hunt becomes a client. | later    |

Phase 0 is deliberately tiny and already removes the hand-maintained JSON files that
`CONTENT_TODO.md` is asking you to fill in. A step-by-step build plan for phases 0 to 3 is in
`docs/design/IMPLEMENTATION_PLAN.md`.

---

## 8. Ideas in the first design (phases 0 to 3)

These need nothing beyond job_hunt and this repo, and are scheduled above.

1. **Claims with provenance everywhere (Phase 0).** Every number on the site is a `claims` row
   with evidence and an as-of date. The footnote becomes a link. Export fails when a public
   claim lacks evidence, and the portfolio's zod schema requires it too. This turns "avoid
   overclaiming" from a writing guideline into a constraint.

2. **Agent-readable you (Phase 0 for files, Phase 3 for MCP).** `/resume.json` (JSON Resume
   schema) and `/llms.txt` are two more files the exporter renders from the same public
   snapshot. The MCP server is the only part with a runtime: a read-only FastAPI router in
   job_hunt that reads the last published snapshot rather than the live vault, so a bug in it
   cannot leak private rows. You build MCP gateways for a living, so being the candidate whose
   portfolio is queryable is both a story and a live demo of the skill the site is selling.

3. **Per-application tailored pages (Phase 2).** When job_hunt tailors a resume for an
   application, also export `/for/<unguessable-token>`: the same site, with featured projects
   and bullets reordered for that role and the matching claims up top, `noindex`. The outreach
   email links to it. Still fully static (one extra page per active application). A small
   tail script on the Caddy host posts `/for/*` hits back to job_hunt as a "viewed" event on
   the application, which becomes a follow-up timing signal. Scheduled after Phase 1 only so
   the visibility and redaction rules have been exercised once before a stranger gets a URL.

## 8b. Ideas for later (need the hub, Tapestry, or Sage)

Story-to-draft writeups and the resume `.docx` artifact were in this list in the first draft;
both are plain job_hunt work and are now scheduled in Phase 2.

4. **Public changelog of you.** `/changelog` fed from the publish log: "2026-10: published
   writeup for MCP gateway; added claim: 6 agents routed". Shows momentum without a blog.
   Cheap once the publish log exists; deferred only because it is cosmetic.

5. **Tapestry as the narrative engine.** The Phase 2 story-to-draft step is a single prompt.
   Tapestry already does "memories into coherent prose with provenance" with a real pipeline.
   When the hub is extracted, Tapestry's story generator over hub stories replaces that prompt.

6. **Sage as an input, carefully.** Sage is deeply personal data; the only defensible public
   projection is a tiny opt-in "now" line ("currently reading X, studying Y"). Treat it as a
   source that feeds drafts into the hub, which then go through the same visibility gate.
   Never let Sage or Tapestry write to the portfolio directly.

---

## 9. Discussion: the "centralized system of me"

What you are describing is a hub-and-spoke personal data platform where each app is a
projection of one core. Here is how I would frame it, and where the risks are.

**What the core actually is.** Not "all data about me". It is the subset that more than one
app needs: identity, experiences, projects, skills with evidence, claims, stories, and
long-form writing. Mood, sleep, calendar, and media (Sage) and raw memories (Tapestry) are
*spoke-local* data. They can produce facts that get promoted into the core (a story, a
learning, a claim), but the raw streams stay where they are. If the core tries to hold
everything it becomes a data lake with a privacy problem.

**Branches are projections with a policy.** Each branch (portfolio, resume generator, job
matcher, MCP endpoint, tailored pages) is defined by three things: which visibility level it
may read, which audience rendering it prefers, and what format it emits. Writing them down as
policy objects in the hub, not as code in each consumer, is what keeps "I accidentally
published something from the bank engagement" impossible rather than unlikely.

**Why not extract the hub now.** The vault schema is good but it has only been shaped by one
consumer (resume generation). The portfolio will push on it in useful ways: slugs, ordering,
public aliases, provenance. Let that pressure land before freezing an API for a standalone
service. The trigger to extract is concrete: the day Tapestry or Sage needs to read or write
experiences. Until then the hub is "job_hunt's `/api/experience`, `/api/profile`, and the new
`/api/publish`", and that is fine.

**Storage and hosting when you do extract.** Postgres on Render is already your pattern
(Tapestry), and pgvector would let the hub own embeddings over stories and bullets instead of
job_hunt's per-user FAISS indexes. The home lab is the alternative, and the publish-by-PR
design means the hub never has to be reachable from the public internet either way.

**Identity across apps.** All four apps have, or plan, their own users table. For a single
person this is harmless. If the hub is extracted, make it the issuer: hub issues JWTs, the
spokes verify. job_hunt's multi-user ADR (your wife's job search) already implies the hub is
multi-tenant from day one, so `user_id` stays on every table.

**Sync direction.** One-way, hub to spokes, for anything public. Spokes propose facts back via
explicit APIs (story parser, claim creation), not by writing tables. Two-way sync between
four apps is where personal platforms go to die.

**Naming.** "job_hunt" is the wrong name for the thing that holds your professional identity.
When extracting, pick a name for the hub and let job_hunt keep its name as a spoke. Options
to react to: `vault` (already the internal term), `loom` (pairs with Tapestry), `ledger`,
`dossier`. Not important yet; worth deciding before the first external consumer.

**Open questions for you**

1. Hosting the hub during phases 0 to 3: stay on the home-lab docker-compose where job_hunt
   runs today, or move job_hunt to Render alongside Tapestry first?
2. Should the publish PR be auto-merged when CI passes and no redaction warnings fired, or do
   you always want to read the diff? (Recommendation: always read it until the alias and
   denylist rules have caught at least one real mistake, then auto-merge for claims and
   capability updates only.)
3. Tailored pages (section 8, idea 3): is view tracking of a recruiter acceptable to you? It is
   first-party, no cookies, and only on token URLs you handed out, but it is still tracking.
4. Which Sage signals, if any, should ever be public?
5. Do you want the writeups to live in the hub (`writings`) or stay as markdown in this repo
   with the hub only owning frontmatter? Hub ownership enables the story-to-draft pipeline;
   repo ownership keeps prose editing in your editor and git.
