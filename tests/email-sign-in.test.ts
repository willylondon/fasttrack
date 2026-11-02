import assert from "node:assert/strict";
import test from "node:test";

import { buildSignInEmail, sendSignInEmail } from "../src/lib/email-sign-in";

const baseRequest = () => ({
  identifier: "member@example.com",
  url: "https://fasttracker.online/api/auth/callback/resend?token=a&email=b",
  provider: { apiKey: "test-key", from: "FastTrack <signin@fasttracker.online>" },
  request: new Request("https://fasttracker.online", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } }),
});

test("escapes the sign-in link in the HTML body and keeps it intact in text", () => {
  const email = buildSignInEmail('https://fasttracker.online/?a=1&b="<x>');

  assert.ok(email.html.includes("a=1&amp;b=&quot;&lt;x&gt;"));
  assert.ok(!email.html.includes('"<x>'));
  assert.ok(email.text.includes('a=1&b="<x>'));
});

test("sends through Resend, limiting by inbox and first forwarded address", async () => {
  const keys: string[] = [];
  let sentBody: { to?: string; from?: string } = {};

  await sendSignInEmail(
    baseRequest(),
    async (key) => {
      keys.push(key);
      return { allowed: true };
    },
    async (_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }
  );

  assert.equal(keys.length, 2);
  assert.match(keys[0], /^auth:email:to:[0-9a-f]{64}$/);
  assert.match(keys[1], /^auth:email:ip:[0-9a-f]{64}$/);
  assert.equal(sentBody.to, "member@example.com");
  assert.equal(sentBody.from, "FastTrack <signin@fasttracker.online>");
});

test("sends nothing when either limit is reached", async () => {
  for (const blocked of ["to", "ip"]) {
    let sent = false;

    await assert.rejects(
      sendSignInEmail(
        baseRequest(),
        async (key) => ({ allowed: !key.includes(`:${blocked}:`) }),
        async () => {
          sent = true;
          return new Response("{}");
        }
      ),
      /Too many/
    );
    assert.equal(sent, false);
  }
});

test("reports a provider failure without exposing its response", async () => {
  await assert.rejects(
    sendSignInEmail(baseRequest(), async () => ({ allowed: true }), async () => new Response("secret detail", { status: 403 })),
    (error: Error) => error.message.includes("403") && !error.message.includes("secret")
  );
});
