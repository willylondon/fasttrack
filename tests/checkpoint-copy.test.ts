import test from "node:test";
import assert from "node:assert/strict";
import { FASTING_STAGES, FASTING_MILESTONES } from "../src/lib/fasting-stages.ts";

test("timer checkpoints describe elapsed time rather than measured physiology", () => {
  for (const checkpoint of [...FASTING_STAGES, ...FASTING_MILESTONES]) {
    assert.doesNotMatch(checkpoint.label, /autophagy|ketosis|glycogen|fat burning/i);
  }
});
