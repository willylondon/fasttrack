export function getAuthErrorMessage(error?: string | string[]): string | null {
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) return null;
  if (code === "OAuthAccountNotLinked") {
    return "This account uses a different sign-in method. Choose the provider you originally used, such as Google. Your accounts have not been linked automatically.";
  }
  if (code === "AccessDenied") return "Sign-in wasn’t completed. You can try again when you’re ready or continue as a guest.";
  return "Sign-in couldn’t finish. Try your usual sign-in method again. You can keep using guest mode while you reconnect.";
}

export function resolveSafeSignInCallback(href: string): string {
  const current = new URL(href);
  const requested = current.searchParams.get("callbackUrl");
  let target = current;
  if (requested) {
    try {
      const candidate = new URL(requested, current.origin);
      if (candidate.origin === current.origin) target = candidate;
    } catch { /* Use the current route for malformed callbacks. */ }
  }
  target.searchParams.delete("error");
  target.searchParams.delete("callbackUrl");
  return target.pathname.startsWith("//") ? "/" : `${target.pathname}${target.search}`;
}
