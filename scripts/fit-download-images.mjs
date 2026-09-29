// Downloads the execution photos referenced in src/lib/fit/exercise-images.ts
// and src/lib/fit/stretches.ts
// from Free Exercise DB (public domain, Unlicense), shrinks them to 640px
// WebP and saves them in public/fit/exercicios/<id>/{0,1}.webp.
// Re-run after adding a mapping: node scripts/fit-download-images.mjs
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import sharp from "sharp";

const BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const src = await readFile(new URL("../src/lib/fit/exercise-images.ts", import.meta.url), "utf8");
const stretches = await readFile(new URL("../src/lib/fit/stretches.ts", import.meta.url), "utf8");
const ids = [
  ...new Set([
    ...[...src.matchAll(/src: "([^"]+)"/g)].map((m) => m[1]),
    // image id is the last string in each stretch definition row
    ...[...stretches.matchAll(/, "([A-Z][A-Za-z0-9_-]+)"(?:, \[[^\]]*\])?\],/g)].map((m) => m[1]),
  ]),
];

let fetched = 0;
for (const id of ids) {
  const dir = new URL(`../public/fit/exercicios/${id}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  for (const frame of ["0", "1"]) {
    const out = new URL(`${frame}.webp`, dir);
    try {
      await access(out);
      continue;
    } catch {}
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/${frame}.jpg`);
    if (!res.ok) throw new Error(`${id}/${frame}: HTTP ${res.status}`);
    const webp = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    await writeFile(out, webp);
    fetched++;
  }
}
console.log(`${ids.length} exercícios, ${fetched} imagens salvas.`);
