# ZakiChat secure email sign-in setup

The `email-login` Edge Function is deployed and the web sign-in form calls it. The function deliberately fails closed until its email-delivery credentials are configured.

## 1. Configure the email sender

1. Create/verify a sending domain with Resend.
2. In Termux, from the repository folder, set the function secrets without committing them to Git:

```sh
npx supabase secrets set --project-ref xdpevlurgtvgduwzyoue \
  RESEND_API_KEY='YOUR_RESEND_API_KEY' \
  'ZAKICHAT_EMAIL_FROM=ZakiChat <no-reply@YOUR-VERIFIED-DOMAIN>'
```

Replace both placeholders locally with real values. Never paste the API key into chat or commit it. The sender address must belong to a domain verified by Resend. If the project uses a different Supabase CLI version, check `npx supabase secrets set --help`.

The function also relies on the standard Supabase Edge Function runtime values `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (or the project's supported secret-key map). Do not expose the service-role key to browser code.

## 2. Allow the auth redirects in Supabase

In **Supabase Dashboard → Authentication → URL Configuration**, add these exact URLs to **Redirect URLs**:

- `https://zakpollyqueens.github.io/ZakiChat-/pages/auth-callback.html`
- `https://zakpollyqueens.github.io/ZakiChat-/pages/reset-password.html`

Set the Site URL to `https://zakpollyqueens.github.io/ZakiChat-/` if that is the project's actual GitHub Pages deployment. If the site is hosted elsewhere, use its real HTTPS hostname instead.

Signup verification and password-reset emails are sent by Supabase Auth, so verify the project's **Authentication → SMTP Settings** and email templates too. The custom sign-in verification email is sent by Resend through `email-login`.

## 3. Test before release

- Register a new account and verify the signup email.
- Try a wrong password: no email should be sent and no session should be created.
- Try a correct password: receive the sign-in verification email, tap its one-time link, and confirm the callback opens Chats.
- Reuse the same verification link: it should not sign in a second time.
- Test password reset, session persistence after reload, explicit sign-out, and an existing legacy phone-only account separately.
- Do not release until email delivery and the actual hosted callback have been tested.

## Android handoff limitation

The repository currently contains the web/PWA source, not the Android application project or its package ID/signing configuration. The callback returns to browser Chats today. Native app handoff requires the actual Android source plus a verified Android App Links setup (package ID, signing certificate fingerprint, and `assetlinks.json`); these must not be guessed.
