import test from "node:test";
import assert from "node:assert/strict";
import { matchesExpectedAccount } from "../src/lib/account-guard.ts";
import { parsePendingRewardIds } from "../src/lib/timer-recovery.ts";

test("account-pinned retries reject a different authenticated account", () => {
  assert.equal(matchesExpectedAccount("account-b", "account-a"), false);
  assert.equal(matchesExpectedAccount("account-a", "account-a"), true);
  assert.equal(matchesExpectedAccount("account-a", undefined), true);
});
test("pending reward queue survives serialization, filters invalid entries and deduplicates", () => {
  const id = "00000000-0000-0000-0000-000000000001";
  assert.deepEqual(parsePendingRewardIds(JSON.stringify([id, id, 5, "not-an-id"])), [id]);
  assert.deepEqual(parsePendingRewardIds("broken"), []);
  assert.deepEqual(parsePendingRewardIds(null), []);
  assert.deepEqual(parsePendingRewardIds('{}'), []);
});
