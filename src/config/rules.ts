/**
 * Community rules shown on /rules.
 *
 * Deliberately empty: add the real rules here and the page, the footer link
 * and the sitemap entry appear on the next build. Nothing is invented.
 *
 * Example:
 *   { title: 'Be kind', body: 'Treat other players the way you want to be treated.' },
 */
export interface Rule {
  title: string;
  body: string;
}

export const rules: Rule[] = [];
