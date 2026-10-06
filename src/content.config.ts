import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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

export const collections = {
  projects: projectsCollection,
  writing: writingCollection,
};
