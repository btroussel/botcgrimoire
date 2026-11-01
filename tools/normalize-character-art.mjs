#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Rim markers use transparent space as coordinates, so only character icons are cropped.
export const isCharacterArt = (local) => /^art\/characters\/.+\.webp$/.test(local);

export async function normalizeCharacterArt(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      // Keep even the faintest antialiasing; RGB in invisible pixels is irrelevant.
      if (data[(y * info.width + x) * info.channels + info.channels - 1] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('Character artwork is entirely transparent');
  // Do not repeatedly compress already-cropped assets. New encodings start from upstream.
  if (left === 0 && top === 0 && right === info.width - 1 && bottom === info.height - 1) return input;
  return sharp(input)
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    // Colour compression saves offline storage; alpha stays exact for edges and placement.
    .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
}

export const prepareAsset = (input, local) => isCharacterArt(local) ? normalizeCharacterArt(input) : Promise.resolve(input);

async function main() {
  const root = fileURLToPath(new URL('../assets/', import.meta.url));
  const check = process.argv.includes('--check');
  let changed = 0, total = 0;
  for (const file of await readdir(path.join(root, 'art/characters'), { recursive: true })) {
    const local = `art/characters/${file.replaceAll(path.sep, '/')}`;
    if (!isCharacterArt(local)) continue;
    total++;
    const target = path.join(root, local);
    const input = await readFile(target);
    const output = await prepareAsset(input, local);
    if (input.equals(output)) continue;
    changed++;
    if (!check) await writeFile(target, output);
  }
  console.log(`${changed}/${total} character images ${check ? 'need cropping' : 'cropped'}`);
  if (check && changed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
