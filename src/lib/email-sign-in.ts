import { checkRateLimit } from "@/lib/rate-limit";

const LINK_LIFETIME_MINUTES = 15;

export const EMAIL_LINK_MAX_AGE_SECONDS = LINK_LIFETIME_MINUTES * 60;

type VerificationRequest = {
  identifier: string;
  url: string;
  provider: { apiKey?: string; from?: string };
  request: Request;
};

type RateLimiter = (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean }>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSignInEmail(url: string) {
  const safeUrl = escapeHtml(url);

  return {
    subject: "Your FastTrack sign-in link",
    text: `Sign in to FastTrack:\n${url}\n\nThis link expires in ${LINK_LIFETIME_MINUTES} minutes and works once. If you didn't request it, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px">Sign in to FastTrack</h1>
  <p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#7c3aed;color:#fff;text-decoration:none">Sign in</a></p>
  <p style="font-size:14px;color:#555">This link expires in ${LINK_LIFETIME_MINUTES} minutes and works once. If you didn't request it, you can ignore this email.</p>
</div>`,
  };
}

// Rate limit keys are stored in the database, so they must not hold addresses in plain text.
async function hashForKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Limits both the inbox and the sender, so this can't be used to flood someone with mail. */
export async function sendSignInEmail(
  { identifier, url, provider, request }: VerificationRequest,
  limiter: RateLimiter = checkRateLimit,
  send: typeof fetch = fetch
) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [inbox, sender] = await Promise.all([
    limiter(`auth:email:to:${await hashForKey(identifier)}`, 3, 10 * 60_000),
    limiter(`auth:email:ip:${await hashForKey(clientIp)}`, 10, 10 * 60_000),
  ]);

  if (!inbox.allowed || !sender.allowed) {
    throw new Error("Too many sign-in emails requested.");
  }

  const response = await send("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: provider.from, to: identifier, ...buildSignInEmail(url) }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the sign-in email with status ${response.status}.`);
  }
}
