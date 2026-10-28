# B2.7 — Independent provider audit rollback checkpoint (source gate)

Baseline: B2.6 main a900d200b274c2a412df17446a3104015ae9b7c3. No schema migration, HTTP route, automatic upload, real supplier request, production secrets, billing/OPanel change or Production Neon operation.

## Threat
The B2.4 HMAC event chain protects integrity within the current database but cannot alone detect a *complete rollback* of the database and its event-chain head to a previously valid earlier state. B2.5 creates a recoverable synthetic snapshot but does not retain it externally.

B2.7 signs a bounded checkpoint containing **only** provider connection UUID, signed audit sequence and audit head, plus an issuance timestamp. When its original bytes are saved independently and immutably, later verification detects missing connections, a valid but rolled-back event history, changed historical events or a substituted artifact. Later legitimate events are allowed by comparing the event at the saved sequence.

## Controls and operator workflow
- Export is default OFF via CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED. CLOUD_PROVIDER_CHECKPOINT_KEY must be its own 32-byte Base64 key, distinct from audit, vault, MFA, recovery and legacy keys, managed outside Neon/source.
- In an independently approved offline Review environment, run: python manage.py provider_audit_checkpoint --output /approved/new/checkpoint.json --confirm=EXPORT-PROVIDER-AUDIT-CHECKPOINT
- The exporter creates an exclusive mode-0600 new local file, refuses overwrite and symlinks, and **never** uploads it. Do not run it against Production in this phase.
- Transfer the original file via a separately approved secure process into independently owned immutable/WORM storage. Preserve every checkpoint and independently certify retention and access controls.
- To compare the **latest independently retained** artifact with the source DB, retrieve it under auditor authority and run: python manage.py provider_audit_checkpoint --verify /approved/retrieved/checkpoint.json
- Verification can run while exporting is disabled. It uses an HMAC key and is not public nonrepudiable signing. Do not store the key in the file or in GitHub.
- Export/verification are bounded to 1000 connections, 1000 events per chain and 256 KiB per artifact. They reject incomplete exports rather than silently truncate.
- A receipt protects only connections and events present when signed. Events created after the last receipt require a new, separately stored checkpoint. An attacker who can replace external receipts or steal both the key and storage write authority can defeat this protection. Store the newest checkpoint in independently controlled WORM storage, with alerting for missed exports.

## Synthetic acceptance
Tests include proper newer events; an *internally valid full rollback* rejected against the checkpoint; missing connection; altered signature; even re-signed malformed or duplicate rows; missing/reused key; disabled export; bad source audit; malformed/oversized data; and exclusive private-file export.

## Not certified or activated
- No external immutable bucket or schedule, dual-control custody or independent timestamp has been provisioned by this PR. AWS S3 Object Lock compliance mode or Google Cloud Bucket Lock can be separately qualified under independent IAM and retention policy, but no provider selection is made here.
- No real Production-sized Neon disaster recovery, hosting file/mail restore, external KMS/HSM, real VPS, network-level egress ACL, DirectAdmin/WHM certification or live credential entry.
- No phishing-resistant WebAuthn qualification, approved MFA recovery or Production providers.0002–0004 migration. TOTP is replay-resistant, not phishing-resistant.
- Do not switch on provider credential forms or provisioning until these separately accepted gates pass.

References:
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html
- AWS S3 Object Lock: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
- Google Cloud Bucket Lock: https://docs.cloud.google.com/storage/docs/bucket-lock
- Neon instant restore: https://neon.com/docs/introduction/branch-restore
