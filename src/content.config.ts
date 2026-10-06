import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { tailoredSchema } from './content/schemas';

const projectsCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  // Project metadata lives in src/content/synced/projects.json (task 0.5); the
  // generated .md files are body-only, so the schema requires only a title.
  schema: z.object({ title: z.string() }),
});

const writingCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(200),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
  }),
});

// Tailored application pages, one JSON file per enabled application. Machine-owned.
const tailoredCollection = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/synced/tailored' }),
  schema: tailoredSchema,
});

export const collections = {
  projects: projectsCollection,
  writing: writingCollection,
  tailored: tailoredCollection,
};
