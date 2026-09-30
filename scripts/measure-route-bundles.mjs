/** Local production-build route client-reference chunks; excludes Next runtime, CSS, async chunks.
 * Run after npm run build: node scripts/measure-route-bundles.mjs
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

const result = {};
for (const route of ["page", "history/page", "profile/page"]) {
  const scope = {};
  runInNewContext(readFileSync(`.next/server/app/${route}_client-reference-manifest.js`, "utf8"), scope);
  const manifest = Object.values(scope.__RSC_MANIFEST)[0];
  const chunks = [...new Set(Object.values(manifest.clientModules).flatMap((entry) => entry.chunks)
    .filter((chunk) => typeof chunk === "string" && chunk.endsWith(".js")))];
  let raw = 0;
  let gzip = 0;
  for (const chunk of chunks) {
    const bytes = readFileSync(chunk.replace("/_next/", ".next/"));
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  result[route] = { raw, gzip, chunks: chunks.length };
}
console.log(JSON.stringify(result, null, 2));
