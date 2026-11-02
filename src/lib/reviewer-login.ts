import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { checkRateLimit } from "@/lib/rate-limit";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60_000;

type ReviewerEnv = Record<string, string | undefined>;

type RateLimiter = (key: string, limit: number, windowMs: number) => Promise<{ allowed: boolean }>;

type QueryError = { message?: string } | null;

export type ReviewerSessionClient = {
  schema(name: "next_auth"): {
    from(table: "users"): {
      select(columns: "id"): {
        eq(column: "email", value: string): {
          maybeSingle(): PromiseLike<{ data: { id: string } | null; error: QueryError }>;
        };
      };
      insert(row: { email: string; name: string; emailVerified: string }): {
        select(columns: "id"): {
          single(): PromiseLike<{ data: { id: string } | null; error: QueryError }>;
        };
      };
    };
  } & {
    from(table: "sessions"): {
      insert(row: { sessionToken: string; userId: string; expires: string }): PromiseLike<{ error: QueryError }>;
    };
  };
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

function matches(supplied: string, expected: string) {
  return timingSafeEqual(sha256(supplied), sha256(expected));
}

/** The login only exists while both values are set, so removing either one turns it off. */
export function isReviewerLoginEnabled(env: ReviewerEnv = process.env) {
  return Boolean(env.REVIEWER_LOGIN_EMAIL?.trim() && env.REVIEWER_LOGIN_PASSWORD);
}

export function reviewerSessionCookieName(secure: boolean) {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

/** Limits each address and all attempts together, so spreading guesses across addresses doesn't help. */
export async function verifyReviewerLogin(
  { email, password, clientIp }: { email: string; password: string; clientIp: string },
  env: ReviewerEnv = process.env,
  limiter: RateLimiter = checkRateLimit
) {
  if (!isReviewerLoginEnabled(env)) {
    return false;
  }

  const [address, everyone] = await Promise.all([
    limiter(`auth:reviewer:ip:${sha256(clientIp).toString("hex")}`, 5, ATTEMPT_WINDOW_MS),
    limiter("auth:reviewer:all", 30, ATTEMPT_WINDOW_MS),
  ]);

  if (!address.allowed || !everyone.allowed) {
    return false;
  }

  const emailMatches = matches(email.trim().toLowerCase(), env.REVIEWER_LOGIN_EMAIL!.trim().toLowerCase());
  const passwordMatches = matches(password, env.REVIEWER_LOGIN_PASSWORD!);

  return emailMatches && passwordMatches;
}

async function findOrCreateReviewer(client: ReviewerSessionClient, email: string) {
  const users = client.schema("next_auth").from("users");
  const existing = await users.select("id").eq("email", email).maybeSingle();

  if (existing.error) {
    throw new Error(`Could not look up the reviewer account: ${existing.error.message}`);
  }

  if (existing.data) {
    return existing.data.id;
  }

  const created = await users
    .insert({ email, name: "App Reviewer", emailVerified: new Date().toISOString() })
    .select("id")
    .single();

  if (created.error || !created.data) {
    throw new Error(`Could not create the reviewer account: ${created.error?.message}`);
  }

  return created.data.id;
}

/** Writes the same session row Auth.js reads, so the rest of the app treats this like any other sign-in. */
export async function createReviewerSession(client: ReviewerSessionClient, email: string, now = Date.now()) {
  const userId = await findOrCreateReviewer(client, email.trim().toLowerCase());
  const sessionToken = randomUUID();
  const expires = new Date(now + SESSION_LIFETIME_MS);
  const { error } = await client
    .schema("next_auth")
    .from("sessions")
    .insert({ sessionToken, userId, expires: expires.toISOString() });

  if (error) {
    throw new Error(`Could not create the reviewer session: ${error.message}`);
  }

  return { sessionToken, expires };
}
