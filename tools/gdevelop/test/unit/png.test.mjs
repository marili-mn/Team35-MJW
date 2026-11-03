// Unit tests for the PNG helpers used by the asset scripts and by the slab colliders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readPng, writePng, opaqueTop } from "../../lib/png.mjs";

const image = (width, height, paint) => {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 4);
  return { width, height, data };
};

test("writePng and readPng round trip, alpha included", () => {
  const img = image(7, 5, (x, y) => [x * 30, y * 50, 200, (x + y) % 2 ? 255 : 0]);
  const back = readPng(writePng(img));
  assert.equal(back.width, 7);
  assert.equal(back.height, 5);
  assert.deepEqual([...back.data], [...img.data]);
});

test("opaqueTop finds where the drawn surface starts", () => {
  // Transparent top quarter, a few loose pixels, then a solid slab.
  const img = image(40, 20, (x, y) => (y < 5 ? [0, 0, 0, 0] : y < 8 ? [0, 0, 0, x % 7 === 0 ? 255 : 0] : [90, 60, 40, 255]));
  assert.equal(opaqueTop(img), 8 / 20);
  assert.equal(opaqueTop(image(4, 4, () => [0, 0, 0, 0])), 1, "an empty image has no surface");
});
