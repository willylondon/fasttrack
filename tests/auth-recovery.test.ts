import test from "node:test";
import assert from "node:assert/strict";
import { getAuthErrorMessage, resolveSafeSignInCallback } from "../src/lib/auth-recovery.ts";

test("account-link failure gives safe original-provider recovery without enabling linking", () => {
  assert.match(getAuthErrorMessage("OAuthAccountNotLinked")!, /originally used/);
  assert.match(getAuthErrorMessage("OAuthAccountNotLinked")!, /not been linked automatically/);
  assert.equal(getAuthErrorMessage(), null);
});
test("unknown authentication errors get generic guidance without reflecting raw input", () => {
  assert.doesNotMatch(getAuthErrorMessage("<script>private-value</script>")!, /private-value|script/);
  assert.match(getAuthErrorMessage("AccessDenied")!, /continue as a guest/);
});
test("sign-in callback stays on this origin and strips stale authentication errors", () => {
  assert.equal(resolveSafeSignInCallback("https://fasttrack.test/?error=OAuthAccountNotLinked&callbackUrl=%2Ffriends"), "/friends");
  assert.equal(resolveSafeSignInCallback("https://fasttrack.test/history?error=oops&callbackUrl=//evil.test"), "/history");
  assert.equal(resolveSafeSignInCallback("https://fasttrack.test/?error=oops"), "/");
  assert.equal(resolveSafeSignInCallback("https://fasttrack.test//evil.test"), "/");
});
