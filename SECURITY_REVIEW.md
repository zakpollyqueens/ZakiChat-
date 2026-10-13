# Molan Chat source security review

Review date: 2026-10-13  
Scope: repository source review and cross-file checks for the icon-studio/security-hardening change. This is not a production penetration test.

## Changes made on this branch

- Corrected an invalid pinned `actions/checkout` SHA in the existing Android build and Supabase deployment workflows, and in the new audit workflow. The valid v4.2.2 commit pin is now used so CI can check out the repository.
- Bumped the Android app version to `zc-vr19` for the next review build.
- Refined the app icon's double outline and the App Icon Studio option previews.
- Added an isolated review-build workflow that uploads APKs as temporary artifacts instead of publishing a public release.

- Added four selectable icon finishes (Emerald Circuit, Crystal Green, Neon Pulse, Liquid Metal), the Settings entry, Android launcher aliases, and a native bridge for changing the actual Android launcher icon.
- Fixed a role mismatch in public notice publishing: the editor already accepts `admin` and `super_admin`, but the server required `super_admin` for every action. Only `admin-notice-save` now accepts either active role; privileged directory, account, billing, and other operations remain super-admin-only.
- Added fail-closed authentication to the push notification webhook using `NOTIFICATIONS_WEBHOOK_SECRET` and `x-zamivox-webhook-secret`.
- Added CI checks for common accidental credential patterns, JavaScript syntax and Android XML validity.
- Added optional Slack build/deployment notifications using the GitHub Actions secret `SLACK_WEBHOOK_URL`.

## Findings and remaining work

### No confirmed literal server secret found in the searched source

Repository searches found no private-key PEM, Slack webhook URL, GitHub personal access token, or Supabase service-role JWT in the searched source. The browser configuration does contain a Supabase public/anon key and a VAPID public key; those are intended for client use and are not substitutes for server secrets. Row-level security and server-side authorization still need to be correctly configured.

This search cannot inspect the actual values stored in GitHub Actions Secrets or Supabase Edge Function Secrets. Review those settings separately and rotate any value that may have been exposed in logs or commits.

### Push webhook must be configured before deployment

Set `NOTIFICATIONS_WEBHOOK_SECRET` in Supabase and configure the database webhook to send the matching `x-zamivox-webhook-secret` header. The endpoint deliberately rejects missing/incorrect authentication. See `supabase/SECURITY-SETUP.md`.

### Release signing is not production-grade yet

`android/app/build.gradle` currently signs the release build with Gradle's debug signing configuration. The workflow builds on a fresh runner, so relying on its debug key is not suitable for reliable production updates. Before public production distribution, configure a persistent private release keystore and protect its password/key material as GitHub Actions Secrets. Do not commit the keystore or passwords.

### WebView JavaScript bridge needs a separate hardening pass

`MainActivity` exposes a JavaScript interface to the WebView. The app currently depends on that bridge for native features, but bridge methods should be reviewed together with all remotely loaded scripts, embedded frames and HTML content. A strict content-security policy, dependency integrity review, and origin-restricted message bridge should be considered before treating the Android wrapper as production-hardened.

### Verification status

Cross-file structural checks passed for the settings link, four icon choices, launcher aliases/drawables, webhook secret guard and workflow additions. The new GitHub Actions audit is the automated validation step; it has not been confirmed green from this review. No APK was built, installed, or device-tested from this branch.
