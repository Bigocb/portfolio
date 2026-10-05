import { defineCollection, z } from 'astro:content';

const projectsCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    summary: z.string().max(200),
    status: z.enum(['active', 'maintained', 'archived', 'concept']),
    featured: z.boolean().default(false),
    year: z.union([z.number(), z.string()]),
    role: z.string(),
    stack: z.array(z.string()),
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    cover: image().optional(),
    order: z.number(),
    confidential_review: z.boolean().default(false),
  }),
});

const writingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string().max(200),
    published: z.date(),
    updated: z.date().optional(),
  }),
});

export const collections = {
  projects: projectsCollection,
  writing: writingCollection,
  data: defineCollection({
    type: 'data',
    schema: z.any().optional(),
  }),
};
