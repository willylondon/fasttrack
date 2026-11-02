# Android release

FastTrack ships to Google Play as a Trusted Web Activity (TWA): a thin Android app that opens the production site full screen in Chrome. Web deploys update the app without a new Play release.

## 1. Deploy the web app

Order matters. The friends page and block features fail if the code ships before the migrations.

1. Back up production, then apply in filename order, trying staging first:
   - `20261102120000_user_safety.sql` (stops if legacy `blocked` friendships exist; review those rows by hand)
   - `20261102130000_shared_rate_limits.sql`
2. Deploy the app.
3. Check signed in with two test accounts: report, block, unblock, delete account.

## 2. Move to the permanent domain

The app is tied to its domain, so do this before building it.

1. Add the domain in Vercel and set `NEXT_PUBLIC_APP_URL`.
2. Add `https://<domain>/api/auth/callback/google` and `.../github` to both OAuth apps.

## 3. Build the app

Needs a JDK and the Android SDK; Bubblewrap offers to install both. Use a package name you'll keep forever, because Play can't change it later.

```bash
npm install -g @bubblewrap/cli
```

```bash
mkdir fasttrack-android && cd fasttrack-android && bubblewrap init --manifest=https://<domain>/manifest.webmanifest
```

```bash
bubblewrap build
```

During `init`, enable notification delegation and confirm the target SDK is 36 or higher, as Play requires. Back up the signing key and passwords somewhere safe, and never commit them.

## 4. Publish the asset links

Without these the app shows a browser bar. In Vercel, set:

- `ANDROID_PACKAGE_NAME`
- `ANDROID_SHA256_CERT_FINGERPRINTS`: comma-separated. Include the upload key and the **App signing key** from Play Console > Test and release > Setup > App signing.

Redeploy, then confirm `https://<domain>/.well-known/assetlinks.json` lists them.

## 5. Play Console

- **Testing:** personal accounts created after Nov 13, 2023 need 12 testers opted in for 14 straight days before applying for production.
- **URLs:** privacy policy `/privacy`, account deletion `/delete-account`.
- **App content:** health apps declaration, Data safety, content rating (answer yes to user-generated content), target audience 18+, and app access instructions with a test sign-in for reviewers.
- **Listing:** 512px icon, 1024x500 feature graphic, phone screenshots. Avoid weight-loss or health claims.

## Ongoing moderation

Reports log `user_report_created` in Vercel and are stored in `public.user_reports`. Review open ones regularly in Supabase and update `status`. Google treats ignored reports as a violation.

```sql
select created_at, reason, content_type, content_snapshot, details, reporter_id, reported_user_id
from public.user_reports where status = 'open' order by created_at;
```
