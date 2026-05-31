# Restore OAuth Sign-In

The app code supports Google and GitHub OAuth when these Vercel environment variables are present:

```txt
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
```

Add each value to Production and Development:

```bash
vercel env add AUTH_GOOGLE_ID production
vercel env add AUTH_GOOGLE_SECRET production
vercel env add AUTH_GITHUB_ID production
vercel env add AUTH_GITHUB_SECRET production

vercel env add AUTH_GOOGLE_ID development
vercel env add AUTH_GOOGLE_SECRET development
vercel env add AUTH_GITHUB_ID development
vercel env add AUTH_GITHUB_SECRET development
```

Then redeploy:

```bash
vercel deploy --prod --yes
```

Verify:

```bash
curl https://fasttrack-alpha.vercel.app/api/auth/providers
```

The response should include `google` and/or `github`.
