/**
 * Content for /rules.
 *
 * While `rules` is empty the page shows a pointer to Discord, is hidden from
 * search engines, and is left out of the footer and the sitemap.
 */
export const rules: string[] = [
  'Be sensible and use common sense. Cherry Creek and its Discord are for all ages, so behave the way you would in any community that welcomes everyone.',
  'Disrespectful, dangerous or inappropriate behaviour will result in a permanent ban.',
];

/** Friendly reminders shown beneath the rules. */
export const reminders: string[] = [
  "Respect other players' builds, claims, resources and belongings.",
  "Don't take items or modify builds without permission.",
  'Use land claims to protect your creations.',
  'Give claim permissions only to players you trust.',
  'Be considerate when using farms, trading halls and community facilities.',
  "Ask for assistance on Discord if a command or feature isn't working as expected.",
];

export const rulesPublished = rules.length > 0;
