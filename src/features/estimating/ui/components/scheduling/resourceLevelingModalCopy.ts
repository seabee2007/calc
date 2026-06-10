export const ALLOW_PROJECT_EXTENSION_LABEL = 'Allow project extension beyond float';

export const PROJECT_EXTENSION_DISABLED_HELPER =
  'When disabled, activities only move within available total float.';

export const PROJECT_EXTENSION_ENABLED_HELPER =
  'When enabled, resource leveling may delay activities past available float and extend the project finish date.';

export const PROJECT_EXTENSION_DISABLED_WARNING =
  'Project extension is not enabled. Enable "Allow project extension" to move activities beyond float.';

/** What resource leveling does — distinct from crew optimization / crashing. */
export const RESOURCE_LEVELING_SCOPE_NOTE =
  'Resource leveling shifts activities to reduce crew over-allocation. It does not change crew sizes or shorten activity durations.';

/** Shown when peak crew demand is already at or below available crew. */
export const RESOURCE_LEVELING_BALANCED_MESSAGE =
  'No activities were moved. Daily crew demand is already within the available crew limit.';

/** Shown when over-allocation remains but no float-based moves were possible. */
export const RESOURCE_LEVELING_NO_FLOAT_MESSAGE =
  'No activities were moved within available total float.';

/** Future feature pointer — separate from resource leveling. */
export const CREW_OPTIMIZATION_FUTURE_NOTE =
  'To shorten durations by assigning extra crew on compressible activities, use Optimize Crew Plan (coming soon). That is crew optimization, not resource leveling.';
