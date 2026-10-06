/**
 * Typed access to the hub-exported snapshot under src/content/synced/.
 *
 * The files are machine-owned (written by `job_hunt publish export`); do not
 * hand-edit. Parsing here means any drift or manual edit fails the build.
 */
import {
  capabilitiesSchema,
  experienceSchema,
  identitySchema,
  manifestSchema,
  projectsDataSchema,
  statsSchema,
} from '../content/schemas';

import capabilitiesJson from '../content/synced/capabilities.json';
import experienceJson from '../content/synced/experience.json';
import identityJson from '../content/synced/identity.json';
import manifestJson from '../content/synced/manifest.json';
import projectsJson from '../content/synced/projects.json';
import statsJson from '../content/synced/stats.json';

export const identity = identitySchema.parse(identityJson);
export const manifest = manifestSchema.parse(manifestJson);
export const experience = experienceSchema.parse(experienceJson);
export const stats = statsSchema.parse(statsJson);
export const capabilities = capabilitiesSchema.parse(capabilitiesJson);
export const projectsData = projectsDataSchema.parse(projectsJson);

/** A project's prose body is the content-collection entry keyed by public_slug. */
export type ProjectMeta = (typeof projectsData)[number];
