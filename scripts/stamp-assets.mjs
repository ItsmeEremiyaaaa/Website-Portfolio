// Adds a content fingerprint (?v=xxxxxxxx) to local CSS/JS links in the HTML pages,
// so browsers and the GitHub Pages cache always fetch the latest version after a change.
// Run with `npm run stamp` before committing CSS or JS changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const pages = ['index.html', '404.html'];
const pattern = /((?:href|src|data-src)=")((?:\/Website-Portfolio\/)?(assets\/(?:css|js)\/[\w.-]+\.(?:css|js)))(?:\?v=[\w]+)?(")/g;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const out = html.replace(pattern, (_, attr, url, file, quote) => {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
    return `${attr}${url}?v=${hash}${quote}`;
  });
  if (out !== html) writeFileSync(page, out);
  console.log(`${page}: ${[...out.matchAll(/\?v=\w+/g)].length} assets stamped`);
}
