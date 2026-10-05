# Implementation plan: publish boundary, admin UI, tailored pages, public MCP

Companion to `ADMIN_AND_HUB_DESIGN.md`. This document is written to be handed to a coding
model one task at a time. Each task names the repo, the files, the exact functions or
schemas to add, and how to prove it works. Tasks within a phase are ordered; do them in order.

Two repositories are involved:

- **HUB** = `bigocb/job_hunt` (Python 3.11, FastAPI, SQLite, React + Vite web app in `web/`)
- **SITE** = `bigocb/portfolio` (Astro 5, static output, Playwright tests, Caddy)

---

## 0. Rules for the implementer

Read these before every task.

1. **Never widen what is public.** Any query feeding the export must filter
   `visibility = 'public'` in SQL. Never filter in Python after a broad select. Never add a
   column to an export without adding it to the allowlist in `publish.py`.
2. **Additive schema only.** New columns are nullable or have defaults. Follow the existing
   migration pattern in HUB `src/job_hunt/experience.py::_migrate_experience_db` (check
   `PRAGMA table_info`, `ALTER TABLE ... ADD COLUMN` if missing). Never drop or rename.
3. **Every function that touches the DB takes `user_id` and `db_path`** keyword arguments,
   like the existing functions in `experience.py`. Tests use `tmp_path` databases.
4. **No em-dashes (the U+2014 character) in anything that reaches SITE content.** Use `--` or
   rewrite the sentence. SITE CI fails on them.
5. **Do not touch `.env`, `.env.example`, or any credential.** Read secrets from
   `os.environ` only. New environment variables are documented in HUB `README.md`.
6. **Tests before done.** HUB: `pytest tests -q`. SITE: `npm run check && npm run build &&
   npm run lint`. A task is not complete until the listed acceptance checks pass.
7. **One commit per task**, message prefixed `feat(publish):`, `feat(admin):`,
   `feat(site):`, `feat(mcp):` or `test:` as appropriate.
8. **When something in this plan contradicts the code you find, stop and report** rather than
   guessing. The plan was written against HUB commit `9593e50` and SITE commit `a045fa8`.

Terminology (from HUB `CONTEXT.md` and `experience.py`):

- **Vault**: tables `experiences`, `projects`, `tech_used`, `bullet_variants`, `stories`.
- **Snapshot**: the directory of files the exporter writes. Defined in task 0.5.
- **Visibility**: `private` (never leaves HUB), `resume` (may be used in generated resumes
  and outreach; this is the current default behaviour), `public` (may be exported).

---

## Phase 0: publish boundary, claims, typed site content

Goal: `python -m job_hunt.cli publish export --out ../portfolio/` writes a snapshot, SITE
builds from it, and SITE serves `/resume.json`, `/llms.txt`, and JSON-LD. No UI yet.

### Task 0.1 (HUB) Visibility and public metadata columns

File: `src/job_hunt/experience.py`

Add to `EXPERIENCE_SCHEMA` (for fresh databases) and to `_migrate_experience_db` (for
existing ones):

| Table             | Column          | Type / default                        |
| ----------------- | --------------- | ------------------------------------- |
| `experiences`     | `visibility`    | `TEXT NOT NULL DEFAULT 'resume'`      |
| `experiences`     | `public_alias`  | `TEXT`                                |
| `experiences`     | `public_note`   | `TEXT`                                |
| `projects`        | `public_slug`   | `TEXT`                                |
| `projects`        | `featured`      | `INTEGER NOT NULL DEFAULT 0`          |
| `projects`        | `sort_order`    | `INTEGER`                             |
| `projects`        | `repo_url`      | `TEXT`                                |
| `projects`        | `demo_url`      | `TEXT`                                |
| `projects`        | `status`        | `TEXT` (active, maintained, archived, concept) |
| `projects`        | `year`          | `TEXT` (display string such as `2024` or `2023-2024`) |
| `projects`        | `role`          | `TEXT`                                |
| `bullet_variants` | `visibility`    | `TEXT NOT NULL DEFAULT 'resume'`      |

Note: `projects.visibility` already exists with default `'internal'`. Treat `'internal'` as
equivalent to `'resume'` everywhere. Add a one-time migration statement
`UPDATE projects SET visibility='resume' WHERE visibility='internal'`.

Add a module constant `VISIBILITY = ("private", "resume", "public")` and a helper
`def validate_visibility(value: str) -> str` that raises `ValueError` on anything else.

Extend `update_experience` and `update_project` (they already accept `**kwargs`) so the new
columns are updatable. Add:

```python
def update_bullet(bullet_id: int, user_id: int = 1, db_path: Path | None = None, **kwargs) -> bool
```

following the same pattern. Validate `visibility` through `validate_visibility` in all three.

Acceptance:

- `pytest tests -q` passes.
- New test file `tests/test_visibility.py`: fresh DB has the columns; a DB created with the old
  schema (build it in the test by executing the pre-change SQL for `projects` only) gains the
  columns after `init_experience_db`; `update_project(..., visibility="nope")` raises.

### Task 0.2 (HUB) Claims table and CRUD

New file: `src/job_hunt/claims.py`

```sql
CREATE TABLE IF NOT EXISTS claims (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 1,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    label       TEXT NOT NULL,
    footnote    TEXT,
    evidence    TEXT,
    as_of       TEXT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    visibility  TEXT NOT NULL DEFAULT 'private',
    sort_order  INTEGER,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(user_id, key)
);
CREATE INDEX IF NOT EXISTS idx_claims_user ON claims(user_id);
```

Functions (same conventions as `experience.py`):

```python
def init_claims_db(path: Path | None = None) -> None
def add_claim(key: str, value: str, label: str, *, footnote=None, evidence=None, as_of=None,
              project_id=None, visibility="private", sort_order=None,
              user_id: int = 1, db_path: Path | None = None) -> int
def update_claim(claim_id: int, user_id: int = 1, db_path: Path | None = None, **kwargs) -> bool
def delete_claim(claim_id: int, user_id: int = 1, db_path: Path | None = None) -> bool
def get_claim(claim_id: int, user_id: int = 1, db_path: Path | None = None) -> dict | None
def list_claims(visibility: str | None = None, user_id: int = 1, db_path: Path | None = None) -> list[dict]
def is_verified(claim: dict) -> bool   # evidence truthy AND as_of truthy
```

`list_claims` returns rows ordered by `sort_order NULLS LAST, id`. Each returned dict includes
a computed `"verified": bool` key.

Call `init_claims_db()` from `init_experience_db()` so one call sets up everything.

Acceptance: `tests/test_claims.py` covers add, update, list filtering by visibility, verified
computation, user scoping (user 1 cannot see user 2's claims), unique key per user.

### Task 0.3 (HUB) Identity table and CRUD

New file: `src/job_hunt/identity.py`

```sql
CREATE TABLE IF NOT EXISTS identity (
    user_id           INTEGER PRIMARY KEY,
    display_name      TEXT,
    tagline           TEXT,
    pitch             TEXT,
    email             TEXT,
    github            TEXT,
    linkedin          TEXT,
    site_url          TEXT,
    availability      TEXT NOT NULL DEFAULT 'not_looking',
    availability_note TEXT,
    updated_at        TEXT NOT NULL
);
```

Functions: `init_identity_db`, `get_identity(user_id, db_path) -> dict | None`,
`upsert_identity(user_id, db_path, **fields) -> dict`,
`seed_identity_from_profile(profile_path, user_id, db_path) -> dict` (fills display_name,
email, github, linkedin from `profile.json` only where the identity row is empty).
`availability` must be one of `open`, `selective`, `not_looking`.

Call `init_identity_db()` from `init_experience_db()`.

Acceptance: `tests/test_identity.py` covers upsert, seed does not overwrite existing values,
invalid availability raises.

### Task 0.4 (HUB) Capabilities derivation

File: `src/job_hunt/publish.py` (created here, extended in later tasks)

```python
def derive_capabilities(user_id: int = 1, db_path: Path | None = None) -> list[dict]
```

Query `tech_used` joined to `projects` where `projects.visibility = 'public'`, grouped by
`tech_used.category`. For each category produce
`{"title": <category title-cased>, "description": <comma-joined distinct technologies,
ordered by count desc then name>, "technologies": [...]}`. Drop rows with a null category.
Return ordered by number of technologies desc.

Acceptance: unit test with two public projects and one private project; the private project's
tech does not appear.

### Task 0.5 (HUB) The exporter

File: `src/job_hunt/publish.py`

Constants:

```python
EXPERIENCE_FIELDS = ("company", "title", "start_date", "end_date", "location",
                     "employment_type", "public_note")
PROJECT_FIELDS = ("name", "description", "impact", "public_slug", "featured", "sort_order",
                  "repo_url", "demo_url", "status", "year", "role", "start_date", "end_date")
BULLET_FIELDS = ("content", "variant_type", "audience")
CLAIM_FIELDS = ("key", "value", "label", "footnote", "evidence", "as_of")
IDENTITY_FIELDS = ("display_name", "tagline", "pitch", "email", "github", "linkedin",
                   "site_url", "availability", "availability_note")
```

These are the **only** columns that may appear in a snapshot. Anything not listed is dropped
by `_pick(row, fields)`.

Functions:

```python
@dataclass
class ExportError(Exception):
    problems: list[str]

def collect(user_id: int = 1, db_path: Path | None = None) -> dict
```

Returns the in-memory snapshot:

```python
{
  "identity":     {...IDENTITY_FIELDS...},
  "experience":   [ {...EXPERIENCE_FIELDS..., "years": "2021-present"} ],   # company replaced by public_alias when set
  "projects":     [ {...PROJECT_FIELDS..., "stack": [tech names], "bullets": [ {...BULLET_FIELDS...} ], "company": alias-or-company } ],
  "stats":        [ {...CLAIM_FIELDS..., "verified": bool} ],
  "capabilities": derive_capabilities(...),
}
```

SQL rules (all WHERE clauses, not Python filters):

- experiences: `visibility='public' AND user_id=?`
- projects: `visibility='public' AND user_id=?`; the parent experience is looked up only to
  obtain `public_alias` or `company`. If the parent experience is not public, use
  `public_alias` if set, otherwise the literal string `"Undisclosed"`. Never the real company.
- bullets: `visibility='public' AND user_id=? AND project_id=?`
- claims: `visibility='public' AND user_id=?`

`years` is derived: `start_date[:4]` plus `-` plus (`end_date[:4]` or `present`).

```python
def check(snapshot: dict, denylist_path: Path | None = None) -> list[str]
```

Returns a list of problems (empty is good):

- any public claim with `verified == False`: `"claim <key> is public but unverified"`
- any public project without `public_slug`: `"project <name> has no public_slug"`
- `public_slug` not matching `^[a-z0-9-]+$`, or duplicate slugs
- more than 3 projects with `featured`
- any string value anywhere in the snapshot containing U+2014
- any string value containing a denylist term (case-insensitive substring). The denylist is
  read from `denylist_path`, defaulting to env `PORTFOLIO_DENYLIST` or
  `data/denylist.txt`. Copy SITE `scripts/denylist.txt` into HUB `data/denylist.txt` as part
  of this task. Lines starting with `#` and blank lines are ignored.
- any public experience whose `company` equals a denylist term and has no `public_alias`

```python
def render(snapshot: dict, out_dir: Path) -> dict[str, str]
```

Writes files and returns `{relative_path: sha256}`:

| Path (relative to `out_dir`)          | Content                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src/content/synced/identity.json`    | `snapshot["identity"]`                                                  |
| `src/content/synced/experience.json`  | `snapshot["experience"]`                                                |
| `src/content/synced/stats.json`       | `snapshot["stats"]`                                                     |
| `src/content/synced/capabilities.json`| `snapshot["capabilities"]`                                              |
| `src/content/synced/projects.json`    | `snapshot["projects"]` (frontmatter data; prose stays in SITE `src/content/projects/*.md` until Phase 2) |
| `src/content/synced/manifest.json`    | `{"generated_at", "hub_version", "files": {path: sha256}}` (written last, excludes itself) |
| `public/resume.json`                  | JSON Resume schema, see below                                           |
| `public/llms.txt`                     | see below                                                               |

All JSON is written with `indent=2`, `sort_keys=True`, `ensure_ascii=False`, trailing newline.
Deterministic output matters: re-running with no DB changes must produce an identical tree.

`public/resume.json` follows the JSON Resume schema (`https://jsonresume.org/schema/`):
`basics` (name, label=tagline, email, url=site_url, summary=pitch, profiles for GitHub and
LinkedIn), `work` (one entry per public experience: name=company-or-alias, position=title,
startDate, endDate, summary=public_note, highlights=public bullets of its public projects),
`projects` (name, description, url=repo_url or demo_url, keywords=stack), `skills` (one per
capability: name=title, keywords=technologies). Omit empty fields.

`public/llms.txt` is plain text:

```
# <display_name>
> <tagline>

<pitch>

## Projects
- [<name>](<site_url>/projects/<public_slug>): <description>
...
## Experience
- <company-or-alias>, <title> (<years>)
...
## Claims
- <value> <label> (as of <as_of>; evidence: <evidence>)
...
## Machine-readable
- <site_url>/resume.json
```

```python
def export(user_id: int = 1, out_dir: Path | None = None, db_path: Path | None = None,
           denylist_path: Path | None = None) -> dict
```

`collect` then `check` (raise `ExportError(problems)` if non-empty) then `render`. Returns the
manifest dict. `out_dir` defaults to env `PORTFOLIO_DIR`.

Acceptance: `tests/test_publish.py` with a seeded `tmp_path` DB:

- private and `resume` rows never appear in any written file (assert by grepping every file
  for a sentinel string such as `SECRET-CO` used as the private company name)
- a non-public parent experience with an alias yields the alias on the project; without an
  alias yields `Undisclosed`
- unverified public claim raises `ExportError` and writes nothing
- a denylist hit raises
- two runs produce byte-identical files
- `resume.json` parses and has `basics.name`

### Task 0.6 (HUB) CLI commands

File: `src/job_hunt/cli.py`. Add a `publish` subcommand group:

```
job_hunt publish check   [--user-id N]
job_hunt publish export  [--user-id N] --out PATH
job_hunt claim add  --key K --value V --label L [--evidence E] [--as-of DATE] [--visibility V] [--footnote F]
job_hunt claim list [--visibility V]
job_hunt claim set  ID --field VALUE ...   (fields: value label footnote evidence as_of visibility sort_order)
job_hunt identity show
job_hunt identity set --field VALUE ...
job_hunt experience set-visibility ID {private|resume|public} [--alias ALIAS] [--note NOTE]
job_hunt project  set-public ID --slug SLUG [--status S] [--featured] [--order N] [--repo URL] [--demo URL] [--year Y] [--role R]
job_hunt bullet   set-visibility ID {private|resume|public}
```

`publish check` prints each problem on its own line and exits 1 if any; `publish export`
prints the manifest paths and exits 1 on `ExportError`.

Acceptance: `tests/test_cli_publish.py` invokes `cli.main([...])` against a temp DB and
`--out tmp_path`, asserts exit codes and that files exist.

### Task 0.7 (HUB) README

Document the publish workflow, the three visibility levels, and the new env vars
`PORTFOLIO_DIR`, `PORTFOLIO_DENYLIST`. One section, under 40 lines.

### Task 0.8 (SITE) Migrate content config to Astro 5 loaders

File: `src/content.config.ts`

Replace the legacy `type: 'content'` / `type: 'data'` collections with loaders:

```ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { identitySchema, experienceSchema, statsSchema, capabilitiesSchema,
         projectsDataSchema, manifestSchema } from './content/schemas';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) => z.object({ /* unchanged fields */ }),
});
const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({ /* unchanged */ }),
});
```

For the synced JSON files, `file()` expects an array of objects with an `id`, or an object
keyed by id. Use `file('src/content/synced/experience.json', { parser: ... })` where the
parser adds `id: String(index)`. For the single-object files (`identity.json`,
`manifest.json`) do **not** use a collection; import them directly in pages
(`import identity from '../content/synced/identity.json'`) and validate with the zod schema
at import time in a small helper `src/lib/synced.ts`:

```ts
export const identity = identitySchema.parse(identityJson);
export const manifest = manifestSchema.parse(manifestJson);
export const experience = experienceSchema.parse(experienceJson);
export const stats = statsSchema.parse(statsJson);
export const capabilities = capabilitiesSchema.parse(capabilitiesJson);
export const projectsData = projectsDataSchema.parse(projectsJson);
```

This keeps one validation path and avoids `file()` id gymnastics. Collections are only used
for the markdown content.

New file `src/content/schemas.ts` with zod schemas matching task 0.5 output. `statsSchema`
requires `verified: z.literal(true)` on every entry (the exporter already guarantees this;
the schema makes the site fail loudly if someone hand-edits the file). `projectsDataSchema`
entries require `public_slug`, `status` enum, `featured` boolean, `stack` string array.

Astro 5 API changes to apply in pages:

- `project.slug` becomes `project.id`
- `const { Content } = await project.render()` becomes
  `import { render } from 'astro:content'; const { Content } = await render(project);`
- `getStaticPaths` params use `project.id`

Files to update: `src/pages/projects/[slug].astro`, `src/pages/projects/index.astro`,
`src/pages/index.astro`, `src/pages/rss.xml.ts`.

Acceptance: `npm run check` has 0 errors; `npm run build` succeeds; `/projects/conclave`
still renders.

### Task 0.9 (SITE) Seed the synced files and switch pages to them

1. Create `src/content/synced/` with hand-written files matching the schemas, using the
   current values from `src/content/data/*.json` and `index.astro` hero copy. Set every stat
   to `verified: true` with a real `evidence` and `as_of` or remove it. Create
   `manifest.json` with `generated_at` of now and empty `files`.
2. Update pages to read from `src/lib/synced.ts`:
   - `index.astro`: hero `h1` from `identity.display_name`, tagline, pitch; stats from
     `stats`; capabilities from `capabilities`; experience preview from `experience`.
   - `experience.astro`: timeline from `experience`; replace the skills TODO with
     `capabilities`.
   - `contact.astro` and `Footer.astro`: links from `identity`.
   - `colophon.astro`: add a line "Content last synced <manifest.generated_at>".
   - Stat tiles: when `evidence` starts with `http`, render the footnote as a link to it.
3. Delete `src/content/data/*.json` and remove their imports. Update `docs/CONTENT.md`
   section "Editing Data Files" to say these files are generated by the HUB exporter and
   must not be edited by hand, with the CLI command to regenerate.
4. Add `public/robots.txt` if missing: `User-agent: *`, `Allow: /`, `Disallow: /for/`,
   `Sitemap: <site>/sitemap-index.xml`.

Acceptance: `npm run build && npm run test`; grep confirms no imports of
`content/data/` remain; home page shows the identity name.

### Task 0.10 (SITE) JSON-LD and machine-readable links

File: `src/layouts/Base.astro`

Add to `<head>`:

```html
<link rel="alternate" type="application/json" href="/resume.json" title="JSON Resume" />
<script type="application/ld+json" set:html={JSON.stringify(personJsonLd)} />
```

where `personJsonLd` is built in a new `src/lib/jsonld.ts` from `identity` and `capabilities`:
`@type: Person`, `name`, `jobTitle` (tagline), `email`, `url`, `sameAs` (GitHub, LinkedIn),
`knowsAbout` (flattened technologies). Add a `noindex?: boolean` prop to `Base` that renders
`<meta name="robots" content="noindex, nofollow">` when true (used in Phase 2).

Caddy CSP: `script-src 'self' 'sha256-...'`. JSON-LD `<script type="application/ld+json">`
is not executed and is not blocked by CSP, so no Caddyfile change is needed. Verify in the
browser console after `docker compose up` that no CSP error appears.

Create placeholder `public/resume.json` and `public/llms.txt` by running the HUB exporter
against the real DB (task 0.6) with `--out` pointing at the SITE checkout, then commit the
result. If the HUB DB is not available to the implementer, hand-write them from the synced
JSON and note it in the commit message.

Acceptance: `npm run build`; `dist/resume.json` and `dist/llms.txt` exist; `dist/index.html`
contains `application/ld+json`; Playwright smoke test added: `GET /resume.json` returns 200
and parses.

### Task 0.11 (SITE) CI additions

File: `.github/workflows/ci.yml`. Add a step after "Type check":

```
- name: Validate synced content
  run: npx tsx scripts/check-synced.ts
```

New `scripts/check-synced.ts`: imports the schemas and parses every file in
`src/content/synced/`, plus `public/resume.json`. Exit 1 with the zod error on failure. Also
fail if any string in those files contains U+2014.

Acceptance: CI green on the branch; deliberately breaking `stats.json` (`verified: false`)
locally makes the script exit 1.

---

## Phase 1: admin UI and PR delivery

Goal: from the HUB web app, curate what is public and press Publish; a PR appears on SITE.

### Task 1.1 (HUB) API routes for claims, identity, visibility

New files under `src/job_hunt/api/routes/`:

`claims.py`, prefix `/api/claims`, all routes `Depends(get_current_user)`, all scoped to
`user.id`:

```
GET    /api/claims                      -> {"claims": [ClaimOut]}
POST   /api/claims                      ClaimIn -> ClaimOut
PATCH  /api/claims/{id}                 ClaimPatch -> ClaimOut
DELETE /api/claims/{id}                 -> {"ok": true}
```

`identity.py`, prefix `/api/identity`:

```
GET    /api/identity                    -> IdentityOut (seeds from profile on first call)
PUT    /api/identity                    IdentityIn -> IdentityOut
```

Extend `experience.py` routes:

```
PATCH  /api/experience/{exp_id}         ExperiencePatch (visibility, public_alias, public_note, and existing fields)
PATCH  /api/experience/projects/{id}    ProjectPatch (visibility, public_slug, featured, sort_order, repo_url, demo_url, status, year, role)
PATCH  /api/experience/bullets/{id}     BulletPatch (visibility, content, audience, variant_type)
```

Return 404 when the row does not belong to the user. Register the routers in
`api/app.py`.

Acceptance: `tests/test_api_publish_routes.py` using FastAPI `TestClient` and the auth
fixture pattern from `tests/test_api_auth.py`: user A cannot PATCH user B's project (404);
invalid visibility returns 422.

### Task 1.2 (HUB) Publish routes

New file `src/job_hunt/api/routes/publish.py`, prefix `/api/publish`:

```
GET  /api/publish/preview   -> {"snapshot": collect(...), "problems": check(...)}
POST /api/publish/export    -> runs export() to a temp dir, returns {"manifest": ..., "files": {path: content_as_text}}
POST /api/publish/pr        -> runs export() to a temp dir, opens the PR (task 1.3), returns {"pr_url", "branch", "manifest"}
GET  /api/publish/history   -> {"publishes": [...]}   (table from task 1.3)
GET  /api/publish/diff      -> compares a fresh render against the last published manifest; returns {"changed": [...], "added": [...], "removed": [...]}
```

`preview` must never raise on problems; it returns them so the UI can show them. `pr`
returns 409 with the problem list when `check` fails, and 409 with `{"detail": "open PR
exists", "pr_url": ...}` when the last publish row has `pr_state = 'open'`.

### Task 1.3 (HUB) GitHub PR delivery

File: `src/job_hunt/publish_github.py`

Env: `PORTFOLIO_GITHUB_TOKEN` (fine-grained token, repository `Bigocb/portfolio`,
permissions Contents read/write and Pull requests read/write), `PORTFOLIO_REPO`
(default `Bigocb/portfolio`), `PORTFOLIO_BASE_BRANCH` (default `main`).

Use `requests` against `https://api.github.com` with headers
`Authorization: Bearer <token>`, `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`. No new dependency.

```python
def open_publish_pr(rendered: dict[str, str], manifest: dict, *, title: str, body: str) -> dict
```

Steps:

1. `GET /repos/{repo}/git/ref/heads/{base}` to get the base sha.
2. `POST /repos/{repo}/git/refs` with `ref = refs/heads/hub/publish-<YYYYMMDD-HHMMSS>`.
3. For each file in `rendered` (path to text): `GET /repos/{repo}/contents/{path}?ref=<branch>`
   to find the existing blob sha (404 means new), then
   `PUT /repos/{repo}/contents/{path}` with base64 content, `branch`, `message`, and `sha`
   if it existed. Skip the PUT when the existing blob's decoded content equals the new content.
4. For each path under `src/content/synced/` that exists on the base branch but is not in
   `rendered`: `DELETE /repos/{repo}/contents/{path}`.
5. `POST /repos/{repo}/pulls` with `head`, `base`, `title`, `body`.
6. Return `{"pr_url": html_url, "pr_number": number, "branch": branch}`.

If no file changed in step 3 and nothing was deleted in step 4, delete the branch ref and
return `{"pr_url": None, "reason": "no changes"}`.

PR body template (markdown):

```
Automated publish from job_hunt.

Generated: <generated_at>
Files changed: <n>

| File | sha256 |
| ---- | ------ |
...

Review checklist:
- [ ] No employer-identifying terms
- [ ] Every stat has evidence I can stand behind
- [ ] Aliases applied where required
```

Add a `publishes` table in `src/job_hunt/publish.py`:

```sql
CREATE TABLE IF NOT EXISTS publishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    target TEXT NOT NULL,              -- 'portfolio'
    manifest_json TEXT NOT NULL,
    pr_url TEXT, pr_number INTEGER, branch TEXT,
    pr_state TEXT,                     -- open | merged | closed | none
    created_at TEXT NOT NULL
);
```

`record_publish(...)` and `list_publishes(...)` functions. `GET /api/publish/history`
refreshes `pr_state` for rows with `pr_state='open'` via `GET /repos/{repo}/pulls/{n}`
(merged if `merged_at` set, else `state`).

Acceptance: `tests/test_publish_github.py` mocks `requests` (use `unittest.mock.patch` on
`job_hunt.publish_github.requests`) and asserts the exact sequence of calls for: one new file,
one unchanged file (no PUT), one deleted file, and the no-changes path. No network in tests.

### Task 1.4 (HUB web) API client and types

Files: `web/src/api/client.ts`, `web/src/api/types.ts`

Add typed functions mirroring tasks 1.1 and 1.2: `fetchClaims`, `createClaim`, `updateClaim`,
`deleteClaim`, `fetchIdentity`, `saveIdentity`, `patchExperience`, `patchProject`,
`patchBullet`, `fetchPublishPreview`, `fetchPublishDiff`, `openPublishPr`,
`fetchPublishHistory`. Follow the existing `authFetch` pattern exactly.

Types: `Claim`, `Identity`, `PublishPreview`, `PublishDiff`, `PublishRecord`. Extend
`Experience`, `Project`, `BulletItem` with the new optional fields.

### Task 1.5 (HUB web) Portfolio section

Files: `web/src/App.tsx` (add tab `portfolio`, icon `Globe` from lucide-react, label
"Portfolio"), new `web/src/pages/Portfolio.tsx` with an inner tab strip, and one component
per sub-view under `web/src/components/portfolio/`:

| Component                | Behaviour                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `PublishOverview.tsx`    | Calls preview + diff + history. Shows problem list (red), changed/added/removed counts, last publish with PR link and state, availability selector bound to identity. |
| `IdentityForm.tsx`       | Form for all identity fields. Save calls `saveIdentity`.                                                              |
| `ExperienceVisibility.tsx` | Table of experiences: company, title, visibility `<select>`, alias input, note input. Inline save on blur. Row turns amber when visibility is public and alias is empty and company matches a denylist term returned by preview problems. |
| `ProjectPublishing.tsx`  | Grouped by experience. Per project: visibility select, slug input (auto-suggest from name, lowercased, hyphens), status select, featured checkbox (disabled when 3 already featured and this one is not), order number, repo/demo/year/role inputs. Expanding a row lists its bullets with a visibility select each. |
| `ClaimsEditor.tsx`       | Table with add row. Columns: key, value, label, footnote, evidence, as_of (date input), visibility, order. Verified badge computed client side the same way (`evidence && as_of`). Public and unverified rows highlighted red. |
| `CapabilitiesPreview.tsx`| Read-only render of `preview.snapshot.capabilities`.                                                                 |
| `PublishPanel.tsx`       | Shows the diff file list; "Open PR" button disabled while problems exist or an open PR exists; on success shows the PR URL. Confirms with a modal listing the files first. |

Styling: reuse the Tailwind utility classes and component patterns already used in
`web/src/pages/Resume.tsx` (cards, `bg-accent`, `text-warm-gray`). No new UI libraries.

Acceptance: `cd web && npm run build && npm run lint` pass. Manual check: the full workflow
in design doc section 5 can be completed from the UI against a local HUB.

### Task 1.6 (SITE) PR template awareness

Add `.github/pull_request_template.md` with the same review checklist as task 1.3 so
human-authored PRs get it too. Confirm the CI from task 0.11 runs on `hub/publish-*` branches
(the existing `on: pull_request` covers it).

---

## Phase 2: writeups, resume artifact, tailored pages

### Task 2.1 (HUB) Writings table and story-to-draft

New file `src/job_hunt/writings.py`:

```sql
CREATE TABLE IF NOT EXISTS writings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    kind TEXT NOT NULL,                 -- project_writeup | post | now
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    body_md TEXT NOT NULL,
    source_story_ids TEXT,              -- JSON array of stories.id
    visibility TEXT NOT NULL DEFAULT 'private',
    published_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(user_id, kind, slug)
);
```

CRUD in the usual pattern plus:

```python
def draft_writeup_from_stories(project_id: int, user_id: int = 1, db_path: Path | None = None,
                               model: str | None = None) -> dict
```

Loads the project, its public bullets, and its stories (`list_stories(project_id=...)`), and
calls the LLM through `rag.config.get_chat_llm` (same as `story_parser.py`) with a prompt
that asks for markdown with exactly these `##` headings, in order: `Problem`, `Approach`,
`Architecture`, `What was hard`, `Results / what I'd change`. Instruct the model: plain
technical prose, no marketing language, no em-dashes, never name an employer that is not in
the provided text, and mark unknowns as `TODO`. Return
`{"title", "summary", "body_md", "source_story_ids"}`. Post-process: replace any U+2014 with
`--`. Do not save; the route saves after the user edits.

Routes `src/job_hunt/api/routes/writings.py`, prefix `/api/writings`: list, get, create,
patch, delete, `POST /api/writings/draft/{project_id}`.

Exporter change (task 0.5 `render`): for each public project that has a public
`project_writeup` writing, write `src/content/projects/<public_slug>.md` with frontmatter
built from the project (`title`, `summary` (max 200 chars, truncate at a word boundary),
`status`, `featured`, `year`, `role`, `stack`, `repo`, `demo`, `order`,
`confidential_review: false`) and the writing body. Projects without a writing are not
written; the SITE keeps whatever markdown already exists for them. Add these paths to the
manifest and to the PR delivery (task 1.3 step 3 handles any path).

Add `writings` to the `check` rules: public writing whose project is not public is a problem.

Admin: add `WriteupsEditor.tsx` (list by project, "Draft from stories" button, a textarea
editor with `react-markdown` preview, visibility select, save).

Acceptance: tests for CRUD and scoping; exporter test shows a project with a public writeup
produces a `.md` with valid frontmatter (parse it with a simple regex and `yaml` is not a
dependency, so assert line by line); draft function is tested with the LLM mocked.

### Task 2.2 (HUB) Resume artifact at publish

In `render`, if `identity` has `display_name`, call
`resume_docx.build_resume(company="", title=identity.tagline, summary=identity.pitch,
relevant_bullets=<all public bullets ordered by project sort_order>, skills=<comma-joined
public technologies>, output_path=out_dir / "public/resume/Robin_Cloutier_Resume.docx")`.
Check `build_resume`'s current behaviour for empty `company` and adjust the header helper if
it prints a stray "for" line. The file name comes from a new env `PORTFOLIO_RESUME_BASENAME`
(default `Resume`), producing `public/resume/<basename>.docx`.

Binary files cannot go through the JSON-text PR path as written; extend
`publish_github.open_publish_pr` to accept `bytes` values and base64 them (the API takes
base64 either way). Add the docx path to the manifest.

SITE: `src/pages/resume.astro` links to `/resume/<basename>.docx` and renders the HTML
resume from `synced` data (identity, experience, projects with bullets, capabilities)
instead of the TODO block. Remove the PDF placeholders or leave one PDF link only if the
file exists at build time (`fs.existsSync` in frontmatter).

Acceptance: exporter test asserts the docx exists and is non-empty; SITE build renders
`/resume` with experience entries.

### Task 2.3 (HUB) Tailored pages export

Schema: add to `applications` (in `db.py::_migrate`):
`portfolio_token TEXT`, `portfolio_enabled INTEGER NOT NULL DEFAULT 0`,
`portfolio_generated_at TEXT`. Create a unique index on `portfolio_token`.

`tracker.py`: `enable_portfolio_page(app_id) -> str` generates
`secrets.token_urlsafe(12)` once and sets enabled; `disable_portfolio_page(app_id)`.

New `src/job_hunt/tailored.py`:

```python
def build_tailored(application: dict, user_id: int = 1, db_path: Path | None = None) -> dict
```

Uses `generator._best_bullets_for_role` style scoring, but **only over public bullets** from
the snapshot (`collect()` output), never the profile or the resume-level vault. Scores each
public project by keyword overlap between its bullets plus stack and the application's
`description_text` plus `title`. Returns:

```python
{
  "token": ..., "company": application["company"], "title": application["title"],
  "generated_at": ..., "intro": "<one paragraph, see below>",
  "featured_slugs": [top 3 project slugs], "project_order": [all public slugs by score],
  "bullets": [top 6 public bullets as {content, project_slug}],
  "claims": [public claim keys ordered by relevance (keyword overlap on label), max 4]
}
```

`intro` is built from a template, not an LLM, to keep the export deterministic:
`"Hello <company> team. This page highlights the parts of my work most relevant to the
<title> role."` Everything on the tailored page is drawn from already-public data; the only
new information is which company you applied to, and that lives behind an unguessable token.

Exporter: for each application with `portfolio_enabled = 1` and a status not in
(`rejected`, `withdrawn`, `closed`), write `src/content/synced/tailored/<token>.json`.
Remove files for applications that are disabled or closed (the PR step deletes paths not in
`rendered` under `synced/`). Add to manifest.

Routes: `POST /api/pipeline/{app_id}/portfolio` (enable, returns token and URL
`<identity.site_url>/for/<token>`), `DELETE` to disable. Admin: a toggle and a copyable URL
on each application card in `Applications.tsx`.

`generator.outreach_email`: when the application has a token, append one line with the URL
to the generated email. Find where the body is assembled and add the line before the signoff.

### Task 2.4 (SITE) Tailored page route

New collection in `content.config.ts`:

```ts
const tailored = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/synced/tailored' }),
  schema: tailoredSchema,
});
```

New page `src/pages/for/[token].astro`: `getStaticPaths` from the `tailored` collection;
renders `Base` with `noindex={true}`; hero with `intro`; the up-to-four claims as stat tiles;
featured projects in `featured_slugs` order as cards (reuse the card markup from
`projects/index.astro`; extract it into `src/components/ProjectCard.astro` first); the six
bullets as a list titled "Most relevant work"; a link to `/projects` and `/resume`.

Exclude `/for/` from the sitemap in `astro.config.mjs`:
`sitemap({ filter: (page) => !page.includes('/for/') })`. `robots.txt` already disallows it
(task 0.9). Caddy: add `header /for/* X-Robots-Tag "noindex, nofollow"` and
`header /for/* Cache-Control "no-store"`.

Acceptance: build with one fixture tailored file committed under
`src/content/synced/tailored/example-token.json` (clearly fake company "Example Corp");
Playwright test asserts `/for/example-token` has `meta[name=robots][content*=noindex]` and
is absent from `dist/sitemap-0.xml`.

### Task 2.5 (SITE and HUB) View events

Caddyfile: inside the site block add

```
log {
  output file /data/access.log {
    roll_size 10mb
    roll_keep 5
  }
  format json
}
```

`/data` is already a Caddy volume in `docker-compose.yml` (verify; add a named volume
`caddy_data:/data` if not).

HUB: table `application_views (id, user_id, application_id, token, viewed_at, path,
referrer, user_agent_family)` in `db.py`. Do not store IP addresses. Route
`POST /api/publish/views` accepting `{"events": [{"token", "viewed_at", "path", "referrer",
"user_agent"}]}` authenticated with header `X-Publish-Secret` equal to env
`PORTFOLIO_VIEW_SECRET` (not JWT; this is a machine caller). Resolve token to application;
drop unknown tokens; reduce `user_agent` to a family string (`Chrome`, `Safari`, `Firefox`,
`bot`, `other`) before storing. Update `applications.updated_at`.

New script `scripts/tail_views.py` in HUB: follows the Caddy JSON log
(`--log /path/access.log`), filters `request.uri` starting with `/for/`, batches events
every 30 seconds, POSTs to `--endpoint` with the secret from env. Idempotent on restart by
persisting the last byte offset in a sidecar file.

Admin: `Applications.tsx` shows "Viewed N times, last <date>" on cards with a token.
`Today.tsx`: a section "Recently viewed by recruiters" listing applications with a view in
the last 7 days.

Acceptance: tests for the ingest route (bad secret 401, unknown token ignored, user agent
reduced); `tail_views.py` tested against a fixture log file with `requests` mocked.

---

## Phase 3: read-only public MCP server

### Task 3.1 (HUB) Snapshot-backed MCP server

Add dependency `mcp>=1.2` to `pyproject.toml`. New file `src/job_hunt/mcp_public.py` using
`mcp.server.fastmcp.FastMCP`:

The server reads **only** the last rendered snapshot directory, env `PUBLIC_SNAPSHOT_DIR`
(the exporter writes a copy to `data/users/<uid>/export/latest/` on every successful
`export`; add that to task 0.5's `export` as a final step). It never opens the database.

Tools (all read-only, all return JSON-serialisable dicts):

```
get_identity()                                   -> identity.json contents
list_experience()                                -> experience.json contents
list_projects(featured_only: bool = False)       -> projects.json entries without bullets
get_project(slug: str)                           -> full project entry incl. bullets, or {"error": "not found"}
search_bullets(query: str, limit: int = 10)      -> bullets ranked by case-insensitive token overlap with query
get_claims()                                     -> stats.json contents
get_writeup(slug: str)                           -> body of src/content/projects/<slug>.md if present
```

Resource: `resume://json` returning `public/resume.json`.

Transport: streamable HTTP mounted into the FastAPI app at `/mcp` in `api/app.py`, guarded
by env `PUBLIC_MCP_ENABLED=1` (default off). Add a simple in-memory rate limit of 60
requests per minute per client IP on that mount (a small middleware; no new dependency).

Document in HUB `README.md` how to point an MCP client at
`https://<host>/mcp` and the fact that it exposes only the published snapshot.

SITE: `llms.txt` (task 0.5) gains a line `- MCP: <mcp_url>` when env `PUBLIC_MCP_URL` is
set at export time. Colophon mentions it.

Acceptance: `tests/test_mcp_public.py` builds a snapshot into `tmp_path` via `render`, points
the server at it, and calls each tool through the in-process client; asserts `search_bullets`
ranks a matching bullet first and `get_project("missing")` returns the error dict; asserts the
server module never imports `job_hunt.db` or `job_hunt.experience`.

---

## Appendix A: environment variables introduced

| Variable                   | Repo | Used by                               | Default                |
| -------------------------- | ---- | ------------------------------------- | ---------------------- |
| `PORTFOLIO_DIR`            | HUB  | `publish export` default `--out`      | none                   |
| `PORTFOLIO_DENYLIST`       | HUB  | `publish.check`                       | `data/denylist.txt`    |
| `PORTFOLIO_GITHUB_TOKEN`   | HUB  | `publish_github`                      | none (required for PR) |
| `PORTFOLIO_REPO`           | HUB  | `publish_github`                      | `Bigocb/portfolio`     |
| `PORTFOLIO_BASE_BRANCH`    | HUB  | `publish_github`                      | `main`                 |
| `PORTFOLIO_RESUME_BASENAME`| HUB  | resume artifact                       | `Resume`               |
| `PORTFOLIO_VIEW_SECRET`    | HUB  | `/api/publish/views`, `tail_views.py` | none (route disabled)  |
| `PUBLIC_SNAPSHOT_DIR`      | HUB  | MCP server                            | `data/users/1/export/latest` |
| `PUBLIC_MCP_ENABLED`       | HUB  | mount `/mcp`                          | `0`                    |
| `PUBLIC_MCP_URL`           | HUB  | `llms.txt` line                       | none                   |

## Appendix B: definition of done per phase

- **Phase 0**: running `publish export` against the real vault, then `npm run build` in SITE,
  produces a site whose home page, experience page, stats, and capabilities come from the
  snapshot; `/resume.json` validates against the JSON Resume schema; CI is green.
- **Phase 1**: a non-technical user can change a visibility flag and open a PR from the HUB
  web app; the PR shows only the intended diff; merging deploys.
- **Phase 2**: a project writeup drafted from stories is live on the site; `/resume` offers a
  `.docx` that matches the site; one real application has a `/for/<token>` page and its
  views appear in the HUB.
- **Phase 3**: an MCP client can call `search_bullets` against the deployed HUB and gets only
  public data.
