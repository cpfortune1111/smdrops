import assert from "node:assert/strict";
import fs from "node:fs";
import {Match3Engine, makeVariant} from "./dist/engine.mjs";

const stage = JSON.parse(fs.readFileSync(new URL("./dist/data/lvl_F_0001_00.json", import.meta.url)));
const sequence = [0.02,0.26,0.51,0.77,0.94,0.14,0.41,0.65,0.88];
let index = 0;
const rng = () => sequence[index++ % sequence.length];

for (const mode of ["score", "collect", "clean"]) {
  const engine = new Match3Engine(makeVariant(stage, mode), rng);
  assert.equal(engine.width, 7);
  assert.equal(engine.height, 7);
  assert.equal(engine.findMatches().cells.size, 0, `${mode} starts stable`);
  assert.ok(engine.hasValidMove(), `${mode} has a legal move`);
  const [a, b] = engine.findHint();
  const before = engine.moves;
  const result = engine.tryMove(a, b);
  assert.equal(result.valid, true);
  assert.equal(engine.moves, before - 1);
  assert.ok(engine.score > 0);
}

console.log("engine tests passed: score, collect, clean");

