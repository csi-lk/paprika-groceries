import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ensureLists } from "../src/groceries";
import { mockGroceries } from "../src/mock";
import { PaprikaClient } from "../src/paprika";
import { buildPayload } from "../src/payload";

const root = join(import.meta.dir, "..");
const publicDir = join(root, "public");
const args = process.argv.slice(2);
const live = args.includes("--live");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? resolve(args[outIndex + 1] ?? "dist") : join(root, "dist");

let lists;
let items;
let fetchedAt = new Date().toISOString();

if (live) {
  const email = process.env.PAPRIKA_EMAIL?.trim();
  const password = process.env.PAPRIKA_PASSWORD;
  if (!email || !password) {
    throw new Error("--live requires PAPRIKA_EMAIL and PAPRIKA_PASSWORD.");
  }
  const client = new PaprikaClient(email, password);
  [lists, items] = await Promise.all([client.groceryLists(), client.groceries()]);
} else {
  const mock = mockGroceries();
  lists = mock.lists;
  items = mock.items;
}

const payload = {
  configured: true,
  ...buildPayload(ensureLists(lists, items), items, null, {
    static: true,
    mock: !live,
    fetchedAt,
  }),
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const file of ["app.js", "styles.css", "icon.svg", "manifest.webmanifest", "robots.txt"]) {
  copyFileSync(join(publicDir, file), join(outDir, file));
}

const marker = '<script src="app.js" type="module"></script>';
const index = readFileSync(join(publicDir, "index.html"), "utf8");
if (!index.includes(marker)) throw new Error("Could not find the app.js script tag in index.html.");
const dataScript = `<script>window.__PAPRIKA_DATA__ = ${JSON.stringify(payload).replaceAll("<", "\\u003c")};</script>`;
writeFileSync(
  join(outDir, "index.html"),
  index.replace(marker, `${dataScript}\n    ${marker}`),
);

console.log(
  `Built ${live ? "live" : "sample"} static site at ${outDir} ` +
  `(${payload.items.length} items, list ${payload.list?.name ?? "none"})`,
);
