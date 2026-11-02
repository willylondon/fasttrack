import type { Instrumentation } from "next";

// Vercel runtime logs are the error record until a dedicated monitoring service
// is chosen. Logs the route and error details only, never request bodies or query strings.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const pathname = request.path.split("?")[0];
  const digest = (error as Error & { digest?: string }).digest;

  console.error("request_error", {
    method: request.method,
    pathname,
    digest,
    routerKind: context.routerKind,
    routeType: context.routeType,
    message: error instanceof Error ? error.message : "Unknown error",
  });
};
