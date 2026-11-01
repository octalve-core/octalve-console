# INT-02 — Production owner email, transactional SMTP and MFA release gate

## What is implemented versus operational

The provider vault database migrations `providers.0002`, `0003` and `0004` were applied against verified Neon `main` and independently queried: vault tables exist, event append-only trigger is enabled, and all new vault collections are empty. An encrypted PostgreSQL dump was restored independently; a separately-held encrypted backup copy was verified by the operator. This schema qualification does NOT authorize plaintext provider credentials, delivery, provisioned services, or a readiness badge.

The existing intended owner account `octalve0@gmail.com` (user ID 3 on the inspected Production branch) already has active `role=admin`, `is_staff=true`, `is_superuser=true`. Its `email_verified_at` was still NULL at the last independent read. **Do not rerun owner promotion, change a verification timestamp by SQL, or create a second owner.**

## Step 1 — Establish an approved transactional sender

Prefer an Octalve-owned, authenticated sender domain with a dedicated transactional mail provider. Brevo is the initial option; Resend is a separately qualified fallback. The send-as mailbox (e.g. `no-reply@octalve.com`) is an example only, not an assumed existing address.

1. In Brevo's dashboard, authenticate the sending domain under Settings > Senders, Domains, IPs > Domains. Use the exact Brevo-provided TXT/DKIM/CNAME records. Check any existing DMARC record before modifications; do not overwrite an existing policy without evaluating impacts. Ensure the domain displays as Authenticated.
2. Create or verify the actual sender address in Brevo.
3. Under Brevo SMTP & API settings, create a limited-purpose SMTP key for Octalve account notifications, and note the provider-supplied **SMTP login**. Do not confuse an SMTP key with a general Brevo API key.
4. Configure the **Vercel `octalve-cloud-api` project only**, target Production, with `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST=smtp-relay.brevo.com`, `EMAIL_PORT=465`, `EMAIL_USE_TLS=false`, `EMAIL_USE_SSL=true`, `EMAIL_TIMEOUT=15`, `EMAIL_HOST_USER=<Brevo SMTP login>`, `EMAIL_HOST_PASSWORD=<Brevo SMTP key>`, `DEFAULT_FROM_EMAIL=<verified Octalve sender>`, `CLOUD_ACCOUNT_EMAIL_ENABLED=true`. Protect the SMTP password as a sensitive/secret value. The remaining fields may be stored as ordinary server configuration. Do not use `NEXT_PUBLIC_*` and do not copy credentials into Console settings, source control, provider vault drafts or chat.
5. Only enable the gate after the sender domain and relay account are verified and the operator authorizes a real email test. Vercel environment changes apply to **new deployments**, not prior ones; deploy reviewed `main` through the controlled Production release, not Preview.
6. On the running API, Admin > Settings > Mail / Security shows delivery **configuration**, not deliverability. Click the explicit Send verification email button while signed in as the account being verified. Confirm receipt in `octalve0@gmail.com`, click the time-limited signed link, then verify the account is marked verified via the authenticated UI and an authorized database read. Never copy the verification URL or token into a ticket or application log.
7. Perform an authorized delivery test to a controlled mailbox; inspect DKIM/SPF/DMARC outcomes and error telemetry without exposing message contents or keys. If sending fails, turn off `CLOUD_ACCOUNT_EMAIL_ENABLED`, qualify SMTP/network/domain, and redeploy. Do not bypass the gate with dummy/filebased SMTP or a database timestamp.

Django 6.0 SMTP settings require `EMAIL_USE_TLS` xor `EMAIL_USE_SSL`; implicit SSL is supported on port 465. Vercel generally permits outgoing SMTP except port 25, but provider/network restrictions must still be verified.

Official sources:
- https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC
- https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP
- https://developers.brevo.com/docs/smtp-integration
- https://docs.djangoproject.com/en/6.0/topics/email/
- https://vercel.com/docs/environment-variables
- https://vercel.com/kb/guide/serverless-functions-and-smtp
- https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html

## Step 2 — Key custody and vault enrollment (separate approval)

Schema migration and verified email are only prerequisites. Before enabling provider credential writes:

- Obtain approved independent external custody for the root Fernet vault key, TOTP step-up encryption key and HMAC audit key, with separately retained recovery material, scoped access, rotation and restore drills. Do not store keys in the same Neon database as ciphertext.
- Require confirmed account ownership, fresh password, genuine MFA enrollment and used-once TOTP. Keep `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED`, `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED`, `CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED` and `CLOUD_PROVIDER_CUSTODY_VERIFIED` OFF until the required evidence is captured.
- Existing Console Integration Store is for provider credential drafts after qualification, not for the Brevo SMTP *bootstrap* password or infrastructure keyring. Provider writes and vendor operations are separate acceptance gates.
- Never assert credential intake is activated solely from a green build, deployed form, empty vault table, or external email delivery.

## Security boundaries

Email verification is not a substitute for step-up MFA. SMTP readiness reports only the presence of a correctly shaped server configuration; it does not authenticate sender DNS or prove mailbox delivery. The owner verification link is signed, bound to user/email/password hash, time-limited, and single-use via persisted verified timestamp. The backend does not expose secret SMTP values or auth tokens in mail-status responses.
