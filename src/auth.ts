import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { SupabaseAdapter } from "@auth/supabase-adapter";

import { EMAIL_LINK_MAX_AGE_SECONDS, sendSignInEmail } from "@/lib/email-sign-in";
import { isReviewerLoginEnabled } from "@/lib/reviewer-login";

const providers = [];
const hasSupabaseAdapterEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Always show Google's account chooser so people with several Google
      // accounts can pick one instead of being signed in silently.
      authorization: { params: { prompt: "select_account" } },
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

// Email links need the database adapter to store their one-time tokens.
const hasEmailSignInEnv = Boolean(
  hasSupabaseAdapterEnv && process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM
);

if (hasEmailSignInEnv) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
      maxAge: EMAIL_LINK_MAX_AGE_SECONDS,
      sendVerificationRequest: (params) => sendSignInEmail(params),
    })
  );
}

export const authProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  github: Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  email: hasEmailSignInEnv,
  // Reviewer sessions are database rows, so this also needs the adapter.
  reviewer: hasSupabaseAdapterEnv && isReviewerLoginEnabled(),
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: hasSupabaseAdapterEnv
    ? SupabaseAdapter({
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      })
    : undefined,
  trustHost: true,
  session: {
    strategy: hasSupabaseAdapterEnv ? "database" : "jwt",
  },
  providers,
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
