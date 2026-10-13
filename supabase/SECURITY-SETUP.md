# Zamivox security and deployment notes

## Notification webhook authentication

The `notifications` Edge Function now requires a shared secret on every webhook request. This prevents unauthenticated callers from using the function to send unsolicited push notifications to registered devices.

Before deploying this change:

1. Generate a long random secret (at least 32 random bytes).
2. Add it to Supabase Edge Function secrets as `NOTIFICATIONS_WEBHOOK_SECRET`. Do not commit the value to Git.
3. In the Supabase Database Webhook that calls `/functions/v1/notifications`, add the HTTP header `x-zamivox-webhook-secret` with the same value.
4. Deploy the `notifications` Edge Function and test one legitimate message notification plus a request without the header (which must receive HTTP 401).
5. Rotate the secret in both places if it is ever exposed.

The function intentionally returns HTTP 503 when its secret is not configured; this is fail-closed behavior. Until the secret and database webhook header are configured, push delivery from that webhook will not work.

## GitHub Actions / Slack

The Android build and Supabase deployment workflows send Slack notifications only when the repository secret `SLACK_WEBHOOK_URL` is configured. Add a Slack incoming-webhook URL in GitHub repository Settings → Secrets and variables → Actions → New repository secret. Never place the webhook URL in source code. If the secret is absent, builds and deployments continue and the notification step reports that it was skipped.

## Secret-scan limitations

The static audit checks committed text for common high-confidence credential patterns, JavaScript syntax, and Android XML validity. It cannot read GitHub or Supabase secret stores, prove database RLS policies are correct, or replace a manual review of deployed configuration and production logs.
