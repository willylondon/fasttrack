import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverOnlyStub = pathToFileURL(path.join(root, "tests", "server-only-stub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { shortCircuit: true, url: serverOnlyStub };
  }

  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }

  if (specifier === "next/headers") {
    return nextResolve("next/headers.js", context);
  }

  if (specifier === "next/navigation") {
    return nextResolve("next/navigation.js", context);
  }

  if (specifier.startsWith("@/")) {
    const mapped = path.join(root, "src", specifier.slice(2));

    try {
      return await nextResolve(pathToFileURL(mapped).href, context);
    } catch {
      return nextResolve(pathToFileURL(`${mapped}.ts`).href, context);
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !path.extname(specifier)
  ) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      return nextResolve(`${specifier}.ts`, context);
    }
  }

  return nextResolve(specifier, context);
}
