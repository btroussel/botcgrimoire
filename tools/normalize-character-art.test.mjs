import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { normalizeCharacterArt, prepareAsset } from './normalize-character-art.mjs';

test('crops asymmetric padding, preserves alpha and does not resample', async () => {
  const pixels = Buffer.alloc(8 * 7 * 4);
  for (let y = 2; y < 5; y++) for (let x = 3; x < 7; x++) {
    pixels.set([24, 80, 160, x === 3 ? 1 : 255], (y * 8 + x) * 4);
  }
  const input = await sharp(pixels, { raw: { width: 8, height: 7, channels: 4 } }).webp({ lossless: true }).toBuffer();
  const output = await prepareAsset(input, 'art/characters/tb/example_g.webp');
  const { data, info } = await sharp(output).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 4);
  assert.equal(info.height, 3);
  const expected = await sharp(input).extract({ left: 3, top: 2, width: 4, height: 3 }).extractChannel('alpha').raw().toBuffer();
  assert.deepEqual(data, expected);
  assert.deepEqual(await normalizeCharacterArt(output), output);
  assert.deepEqual(await normalizeCharacterArt(input), output);
  for (const local of ['art/tokens/markers/firstnight.webp', 'art/tokens/character_bg.webp', 'art/editions/tb.webp', 'data/raw/release/roles.json']) {
    assert.equal(await prepareAsset(input, local), input);
  }
});

test('rejects blank art and retains an opaque image unchanged', async () => {
  const make = (alpha) => sharp({ create: { width: 4, height: 3, channels: 4, background: { r: 30, g: 60, b: 90, alpha } } }).webp({ lossless: true }).toBuffer();
  await assert.rejects(normalizeCharacterArt(await make(0)), /entirely transparent/);
  const opaque = await make(1);
  assert.equal(await normalizeCharacterArt(opaque), opaque);
});
