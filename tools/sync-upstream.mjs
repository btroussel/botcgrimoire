#!/usr/bin/env node
// Mirrors the upstream files kept under assets/ (game data, script schema, art, translations)
// at the current commit of each repository's ref, and records that commit in assets/upstream.json.
//
//   node tools/sync-upstream.mjs           fetch, write what changed, stamp the revisions
//   node tools/sync-upstream.mjs --check   report what would change, write nothing (exit 1 if so)
//
// Everything is fetched at one commit per repository so data and art come from the same snapshot.
// The character list comes from roles.json and the file list from the repository tree, so a new
// character upstream arrives with its art in the same run and a missing icon is a line in the
// report, not a guess. Uses Sharp for character art. GITHUB_TOKEN is optional and lifts the API
// rate limit.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareAsset } from "./normalize-character-art.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");
const MANIFEST = path.join(ASSETS, "upstream.json");
const CHECK = process.argv.includes("--check");
const CONCURRENCY = 8;

const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

async function api(url, accept = "application/vnd.github+json") {
  const res = await fetch(url, { headers: { ...headers, Accept: accept } });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res;
}

const resolveSha = async (repo, ref) =>
  (await (await api(`https://api.github.com/repos/${repo}/commits/${ref}`, "application/vnd.github.sha")).text()).trim();

// One request for the whole file list at that commit.
async function listTree(repo, sha) {
  const { tree, truncated } = await (await api(`https://api.github.com/repos/${repo}/git/trees/${sha}?recursive=1`)).json();
  if (truncated) throw new Error(`${repo}: tree listing truncated`);
  return new Set(tree.filter((e) => e.type === "blob").map((e) => e.path));
}

async function fetchRaw(repo, sha, file) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/${file}`, { headers });
  if (!res.ok) throw new Error(`${repo}/${file}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function pool(items, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) await worker(items[i++]);
  }));
}

const stats = { changed: [], added: [], missing: [], stale: [], same: 0 };

// The botc-release plan: data, schema, the logos of editions with characters and of custom
// scripts, and per character and generic team icon the good and evil tints when upstream has them
// (the base editions and most of carousel), else its single icon (fabled, loric, good, evil, the
// newest carousel characters). Pairs of [remote path, local path]. Every file is part of the
// offline download, so art no screen can reach stays upstream: the logo of an edition with no
// characters yet, the icons of the "custom" team no character belongs to, and a team's single
// icon beside its tints, which copies one of them.
function planRelease(tree, roles) {
  const files = [
    ...["roles", "jinxes", "nightsheet"].map((n) => [`resources/data/${n}.json`, `data/raw/release/${n}.json`]),
    ["script-schema.json", "schema/script.schema.json"],
  ];
  const logos = new Set([...roles.map((r) => r.edition), "custom"]);
  for (const p of tree) {
    const m = p.match(/^resources\/editions\/([^/]+)\/logo\.webp$/);
    if (m) { if (logos.has(m[1])) files.push([p, `art/editions/${m[1]}.webp`]); }
    else if (p.startsWith("resources/characters/generic/") && !/\/custom(_[ge])?\.webp$/.test(p)
      && !tree.has(p.replace(/\.webp$/, "_g.webp"))) files.push([p, p.replace("resources/", "art/")]);
  }
  for (const r of roles) {
    const base = `characters/${r.edition}/${r.id}`;
    const variants = tree.has(`resources/${base}_g.webp`) ? ["_g", "_e"] : [""];
    for (const v of variants) {
      if (tree.has(`resources/${base}${v}.webp`)) files.push([`resources/${base}${v}.webp`, `art/${base}${v}.webp`]);
      else stats.missing.push(`art/${base}${v}.webp`);
    }
  }
  return files;
}

const planTranslations = (locales) => locales.map((l) => [`game/${l}.json`, `data/raw/translations/game/${l}.json`]);

// Flavor text is bundled into the offline download, yet no screen shows it: it is about a tenth of
// the app's script. The character data and its translations arrive without it, with every other
// byte as upstream wrote it, so the mirrored files still read as upstream's.
const flavor = String.raw`[ \t]*"flavor": "(?:[^"\\\r\n]|\\.)*"`;
// After another property the line takes the comma before it; first in its object, the one after.
const flavorLine = new RegExp(String.raw`,\r?\n${flavor}(?=,|\r?\n)|(?<=\{)\r?\n${flavor},`, "g");
const withoutFlavor = (value) => Array.isArray(value) ? value.map(withoutFlavor)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== "flavor").map(([k, v]) => [k, withoutFlavor(v)]))
  : value;
function prepareData(buf, local) {
  if (!/^data\/raw\/(release\/roles|translations\/game\/[^/]+)\.json$/.test(local)) return buf;
  const text = buf.toString("utf8");
  const out = text.replace(flavorLine, "");
  if (JSON.stringify(JSON.parse(out)) !== JSON.stringify(withoutFlavor(JSON.parse(text)))) throw new Error(`${local}: flavor not removed cleanly`);
  return Buffer.from(out, "utf8");
}

// Text is compared with line endings normalised: git may check the local copy out with CRLF.
const normalise = (buf, local) => (local.endsWith(".json") ? buf.toString("utf8").replace(/\r\n/g, "\n") : buf);

async function mirror(repo, sha, files) {
  await pool(files, async ([remote, local]) => {
    const data = prepareData(await prepareAsset(await fetchRaw(repo, sha, remote), local), local);
    const target = path.join(ASSETS, local);
    if (existsSync(target)) {
      const a = normalise(data, local), b = normalise(await readFile(target), local);
      if (Buffer.isBuffer(a) ? Buffer.compare(a, b) === 0 : a === b) return void stats.same++;
      stats.changed.push(local);
    } else stats.added.push(local);
    if (!CHECK) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    }
  });
}

// Local files under a mirrored folder that the plan no longer names: a renamed or removed role.
async function findStale(planned, folder) {
  const known = new Set(planned.map(([, local]) => local));
  const dir = path.join(ASSETS, folder);
  if (!existsSync(dir)) return;
  for (const f of await readdir(dir, { recursive: true })) {
    const local = `${folder}/${f.replaceAll(path.sep, "/")}`;
    if (!known.has(local) && path.extname(f)) stats.stale.push(local);
  }
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const now = new Date().toISOString();

for (const [name, src] of Object.entries(manifest)) {
  const sha = await resolveSha(src.repo, src.ref);
  const pinned = src.revision ? src.revision.slice(0, 10) : "nothing";
  console.log(`${name}: ${src.repo}@${src.ref} is ${sha.slice(0, 10)}, pinned ${sha === src.revision ? "there" : pinned}`);

  let files;
  if (name === "botc-release") {
    const tree = await listTree(src.repo, sha);
    const roles = JSON.parse((await fetchRaw(src.repo, sha, "resources/data/roles.json")).toString("utf8"));
    files = planRelease(tree, roles);
    await findStale(files, "art/characters");
    await findStale(files, "art/editions");
  } else {
    files = planTranslations(src.locales);
  }
  await mirror(src.repo, sha, files);
  if (!CHECK) Object.assign(src, { revision: sha, fetchedAt: now });
}

const list = (label, xs) => xs.length && console.log(`${label} (${xs.length}):\n  ${xs.sort().join("\n  ")}`);
list(CHECK ? "would change" : "changed", stats.changed);
list(CHECK ? "would add" : "added", stats.added);
list("upstream has no icon for", stats.missing);
list("local but not upstream, delete by hand", stats.stale);
console.log(`${stats.same} files identical`);

if (!CHECK) {
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`revisions stamped in ${path.relative(ROOT, MANIFEST)}`);
} else if (stats.changed.length || stats.added.length) process.exitCode = 1;
