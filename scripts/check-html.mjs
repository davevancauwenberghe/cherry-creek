// Guards against a formatting slip that is easy to miss in review: a word
// glued to an inline element, as in "with a<strong>golden shovel</strong>",
// which renders as "agolden shovel". Run after `npm run build`.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/client/', import.meta.url));

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

// A letter directly before an opening <strong>/<a>/<code>, or a letter or
// digit directly after its closing tag.
const GLUED =
  /[A-Za-z,](?:<(?:strong|a|code)\b[^>]*>)[A-Za-z0-9/€]|[A-Za-z0-9](?:<\/(?:strong|a|code)>)[A-Za-z0-9€]/g;

let problems = 0;
for (const file of await htmlFiles(dist)) {
  const html = (await readFile(file, 'utf8')).replace(
    /<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/g,
    '',
  );
  for (const match of html.matchAll(GLUED)) {
    problems++;
    const context = html
      .slice(Math.max(0, match.index - 40), match.index + match[0].length + 30)
      .replace(/<[^>]+>/g, '¦')
      .replace(/\s+/g, ' ');
    console.error(`${relative(dist, file)}: …${context}…`);
  }
}

if (problems > 0) {
  console.error(
    `\n${problems} place(s) where text is glued to an inline element. Add {' '} in the source.`,
  );
  process.exit(1);
}
console.log('Built HTML: no text glued to inline elements.');
