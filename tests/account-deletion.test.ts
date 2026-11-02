import assert from "node:assert/strict";
import test from "node:test";

import { deleteAccount, type AccountDeletionClient } from "../src/lib/account-deletion";

const USER_ID = "00000000-0000-0000-0000-00000000000a";

function fakeClient({ files = ["avatar-1.png"], listError = null as unknown, removeError = null as unknown, deleteError = null as unknown } = {}) {
  const calls: string[] = [];
  let remaining = [...files];
  const client: AccountDeletionClient = {
    storage: {
      from: () => ({
        list: async (path) => {
          calls.push(`list:${path}`);
          return { data: remaining.map((name) => ({ name })), error: listError };
        },
        remove: async (paths) => {
          calls.push(`remove:${paths.join(",")}`);
          if (!removeError) remaining = [];
          return { data: null, error: removeError };
        },
      }),
    },
    schema: () => ({
      from: () => ({
        delete: () => ({
          eq: async (_column, value) => {
            calls.push(`delete:${value}`);
            return { error: deleteError };
          },
        }),
      }),
    }),
  };

  return { calls, client };
}

test("removes only this user's avatars, then deletes the user", async () => {
  const { calls, client } = fakeClient();

  await deleteAccount(client, USER_ID);

  assert.deepEqual(calls, [
    `list:${USER_ID}`,
    `remove:${USER_ID}/avatar-1.png`,
    `list:${USER_ID}`,
    `delete:${USER_ID}`,
  ]);
});

test("deletes a user who has no avatars", async () => {
  const { calls, client } = fakeClient({ files: [] });

  await deleteAccount(client, USER_ID);

  assert.deepEqual(calls, [`list:${USER_ID}`, `delete:${USER_ID}`]);
});

test("keeps the account when avatars cannot be listed or removed", async () => {
  for (const options of [{ listError: new Error("list") }, { removeError: new Error("remove") }]) {
    const { calls, client } = fakeClient(options);

    await assert.rejects(deleteAccount(client, USER_ID));
    assert.ok(!calls.includes(`delete:${USER_ID}`));
  }
});

test("surfaces a failed user delete", async () => {
  const { client } = fakeClient({ deleteError: new Error("delete") });

  await assert.rejects(deleteAccount(client, USER_ID), /delete/);
});
