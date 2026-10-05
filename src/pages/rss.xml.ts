import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: any) {
  const projects = await getCollection('projects');

  return rss({
    title: 'Robin Cloutier | Projects',
    description: 'Projects and writeups from Robin Cloutier, Senior Software Engineer.',
    site: context.site,
    items: projects
      .filter(p => !p.data.confidential_review)
      .map(project => {
        const year = typeof project.data.year === 'number'
          ? project.data.year
          : parseInt(String(project.data.year).split('-')[0]);
        return {
          title: project.data.title,
          description: project.data.summary,
          pubDate: new Date(year, 0, 1),
          link: `/projects/${project.slug}`,
        };
      }),
  });
}
