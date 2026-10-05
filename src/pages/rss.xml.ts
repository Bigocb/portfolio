import rss from '@astrojs/rss';
import { projectsData } from '../lib/synced';

export async function GET(context: any) {
  const projects = projectsData.filter(p => p.public_slug);

  return rss({
    title: 'Robin Cloutier | Projects',
    description: 'Projects and writeups from Robin Cloutier, Senior Software Engineer.',
    site: context.site,
    items: projects.map(project => {
      const year = parseInt(String(project.year ?? '').split('-')[0]) || 2024;
      return {
        title: project.name,
        description: project.description ?? '',
        pubDate: new Date(year, 0, 1),
        link: `/projects/${project.public_slug}`,
      };
    }),
  });
}
