import assert from "node:assert/strict";
import test from "node:test";

import { buildAssetLinks } from "../src/lib/asset-links";

test("publishes nothing until the package and fingerprints are configured", () => {
  assert.deepEqual(buildAssetLinks(), []);
  assert.deepEqual(buildAssetLinks("com.example.app", " , "), []);
  assert.deepEqual(buildAssetLinks("", "AA:BB"), []);
});

test("includes every configured signing fingerprint in Google's format", () => {
  const [statement] = buildAssetLinks("com.example.app", "aa:bb, CC:DD");

  assert.deepEqual(statement.relation, ["delegate_permission/common.handle_all_urls"]);
  assert.deepEqual(statement.target, {
    namespace: "android_app",
    package_name: "com.example.app",
    sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
  });
});
