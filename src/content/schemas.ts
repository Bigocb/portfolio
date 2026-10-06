import { z } from 'zod';

/**
 * Schemas for the hub-exported snapshot files under src/content/synced/.
 *
 * These are validated at import time (src/lib/synced.ts) so the site fails
 * loudly if a synced file is hand-edited or the exporter drifts. Field names
 * mirror the HUB exporter allowlists in job_hunt/publish.py.
 */

export const identitySchema = z.object({
  display_name: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  pitch: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  github: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  site_url: z.string().nullable().optional(),
  availability: z.enum(['open', 'selective', 'not_looking']).default('not_looking'),
  availability_note: z.string().nullable().optional(),
});

export const experienceSchema = z.array(
  z.object({
    company: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    employment_type: z.string().nullable().optional(),
    public_note: z.string().nullable().optional(),
    years: z.string().nullable().optional(),
  })
);

export const statsSchema = z.array(
  z.object({
    key: z.string(),
    value: z.string(),
    label: z.string(),
    footnote: z.string().nullable().optional(),
    evidence: z.string().nullable().optional(),
    as_of: z.string().nullable().optional(),
    // The exporter only emits verified public claims; require it so a hand
    // edit that flips this is caught at build time.
    verified: z.literal(true),
  })
);

export const capabilitiesSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string(),
    technologies: z.array(z.string()),
  })
);

const projectSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  impact: z.string().nullable().optional(),
  public_slug: z.string().nullable().optional(),
  featured: z.union([z.number(), z.boolean()]).nullable().optional(),
  sort_order: z.number().nullable().optional(),
  repo_url: z.string().nullable().optional(),
  demo_url: z.string().nullable().optional(),
  status: z.enum(['active', 'maintained', 'archived', 'concept']).nullable().optional(),
  year: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  stack: z.array(z.string()).default([]),
  bullets: z
    .array(
      z.object({
        content: z.string(),
        variant_type: z.string().nullable().optional(),
        audience: z.string().nullable().optional(),
      })
    )
    .default([]),
});

export const projectsDataSchema = z.array(projectSchema);

export const manifestSchema = z.object({
  generated_at: z.string(),
  hub_version: z.string(),
  files: z.record(z.string()),
});
