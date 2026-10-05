import { identity, capabilities } from './synced';

/**
 * schema.org/Person JSON-LD built from the hub snapshot. Zero runtime cost;
 * makes the site legible to search engines and agents.
 */
export function personJsonLd() {
  const sameAs = [identity.github, identity.linkedin].filter(Boolean) as string[];
  const knowsAbout = [...new Set(capabilities.flatMap(c => c.technologies))];

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
  };
  if (identity.display_name) data.name = identity.display_name;
  if (identity.tagline) data.jobTitle = identity.tagline;
  if (identity.email) data.email = identity.email;
  if (identity.site_url) data.url = identity.site_url;
  if (sameAs.length) data.sameAs = sameAs;
  if (knowsAbout.length) data.knowsAbout = knowsAbout;
  return data;
}
