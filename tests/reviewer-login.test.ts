import assert from "node:assert/strict";
import test from "node:test";

import {
  createReviewerSession,
  isReviewerLoginEnabled,
  reviewerSessionCookieName,
  verifyReviewerLogin,
  type ReviewerSessionClient,
} from "../src/lib/reviewer-login";

const env = { REVIEWER_LOGIN_EMAIL: "Reviewer@FastTracker.online", REVIEWER_LOGIN_PASSWORD: "correct horse" };
const allow = async () => ({ allowed: true });
const attempt = (email: string, password: string) => ({ email, password, clientIp: "203.0.113.9" });

test("stays off unless both the email and password are set", () => {
  assert.equal(isReviewerLoginEnabled({}), false);
  assert.equal(isReviewerLoginEnabled({ REVIEWER_LOGIN_EMAIL: "a@b.c" }), false);
  assert.equal(isReviewerLoginEnabled({ REVIEWER_LOGIN_PASSWORD: "x" }), false);
  assert.equal(isReviewerLoginEnabled(env), true);
});

test("rejects every login while switched off, without using the limiter", async () => {
  let calls = 0;
  const result = await verifyReviewerLogin(attempt("a@b.c", "x"), {}, async () => {
    calls += 1;
    return { allowed: true };
  });

  assert.equal(result, false);
  assert.equal(calls, 0);
});

test("needs both the right email and the exact password", async () => {
  assert.equal(await verifyReviewerLogin(attempt(" reviewer@fasttracker.online ", "correct horse"), env, allow), true);
  assert.equal(await verifyReviewerLogin(attempt("reviewer@fasttracker.online", "Correct horse"), env, allow), false);
  assert.equal(await verifyReviewerLogin(attempt("member@example.com", "correct horse"), env, allow), false);
  assert.equal(await verifyReviewerLogin(attempt("reviewer@fasttracker.online", ""), env, allow), false);
});

test("refuses correct details once limited, and doesn't store the address in plain text", async () => {
  const keys: string[] = [];
  const result = await verifyReviewerLogin(attempt("reviewer@fasttracker.online", "correct horse"), env, async (key) => {
    keys.push(key);
    return { allowed: !key.endsWith(":all") };
  });

  assert.equal(result, false);
  assert.match(keys[0], /^auth:reviewer:ip:[0-9a-f]{64}$/);
  assert.equal(keys[1], "auth:reviewer:all");
});

function fakeClient(existingId: string | null) {
  const created: unknown[] = [];
  const sessions: Array<{ sessionToken: string; userId: string; expires: string }> = [];
  const client = {
    schema: () => ({
      from: (table: string) =>
        table === "users"
          ? {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: existingId ? { id: existingId } : null, error: null }),
                }),
              }),
              insert: (row: unknown) => {
                created.push(row);
                return { select: () => ({ single: async () => ({ data: { id: "new-user" }, error: null }) }) };
              },
            }
          : {
              insert: async (row: (typeof sessions)[number]) => {
                sessions.push(row);
                return { error: null };
              },
            },
    }),
  } as unknown as ReviewerSessionClient;

  return { client, created, sessions };
}

test("reuses the reviewer account and creates a 7-day session", async () => {
  const { client, created, sessions } = fakeClient("existing-user");
  const now = Date.UTC(2026, 10, 2);
  const session = await createReviewerSession(client, "Reviewer@FastTracker.online", now);

  assert.equal(created.length, 0);
  assert.equal(sessions[0].userId, "existing-user");
  assert.equal(sessions[0].sessionToken, session.sessionToken);
  assert.equal(session.expires.getTime(), now + 7 * 24 * 60 * 60 * 1000);
});

test("creates the reviewer account if it was deleted during review", async () => {
  const { client, created, sessions } = fakeClient(null);

  await createReviewerSession(client, "reviewer@fasttracker.online");

  assert.equal(created.length, 1);
  assert.equal(sessions[0].userId, "new-user");
});

test("uses the cookie name Auth.js reads", () => {
  assert.equal(reviewerSessionCookieName(true), "__Secure-authjs.session-token");
  assert.equal(reviewerSessionCookieName(false), "authjs.session-token");
});
