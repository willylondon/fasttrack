/** Run after npm run build. No services, credentials, or network requests. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8"));
const actions = [...Object.values(manifest.node ?? {}), ...Object.values(manifest.edge ?? {})];
assert.equal(actions.some((action) => action.filename === "src/lib/notifications.ts" || action.exportedName === "notifyEncouragementRecipient"), false,
  "The internal notification helper must not be registered as a remotely callable Server Action");
console.log("PASS: notification delivery is absent from the built Server Action manifest");
