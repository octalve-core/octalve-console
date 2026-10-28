# B2.8 — WORM checkpoint evidence transport: source-only certification candidate

Baseline: merged B2.7, ee97c2a80e681212df11cc0ccd975a078ff3e37b. Adds an explicit, dependency-injected S3 Object Lock handoff and synthetic acceptance. Does not create an AWS bucket, role, KMS key, Neon branch, deploy to Vercel, contact a real supplier, rotate keys, enable credentials or run real restoration.

## Threat finding
S3 Object Lock COMPLIANCE protects an object VERSION, not the unversioned object name. An ordinary DELETE can produce a delete marker even when an older version remains protected. All externally accepted checkpoints MUST bind bucket, account, key, VersionId, SHA-256, retention, and scope; store coordinates independently of the producing application. Never trust an unversioned GET or untrusted latest pointer.

## Source behavior
- providers.worm_checkpoint.WORMPolicy validates approved region, 12-digit bucket owner, KMS ARN matching owner/region and bounded retention.
- store_locked_receipt requires explicit approval, separately provided authenticated client, B2.7 HMAC-verified receipt and PREEXISTING versioned Object-Lock enabled bucket. Only get_object_lock_configuration, get_bucket_versioning, put_object and get_object are used. It never creates resources or alters bucket policy.
- PUT requires IfNoneMatch=* and COMPLIANCE retention with approved KMS ARN, ExpectedBucketOwner and a digest-derived unique key.
- An exact returned VersionId is read back and checked for SHA-256, signed source scope, compliance retention and KMS identity before reporting success. Failure to read or validate is NOT success, even if a version might have been written.
- This is a dependency-injected S3 client interface; boto3 is NOT installed or automatically configured. The operator must independently approve/pin an SDK and credentials before any AWS exercise.
- Synthetic CI uses fake object-store storage and exercises default-deny, wrong WORM mode, suspended versioning, disallowed overwrite, outage, corruption, bad KMS account/region, wrong scope/version and shortened retention without real AWS calls.

## Remaining operational acceptance — NOT complete
1. Approve independent AWS account, region, retention policy/cost/irreversibility, security roles, independent key custody, alerts and exception approval. A live Object Lock COMPLIANCE object is effectively irreversible until expiration.
2. Create independent exporter and auditor identities: scoped append-only export, independent read/version metadata, separate trusted checkpoint index outside Console operators; audit and incident alerting.
3. Qualify an explicit KMS CMK and SSE-KMS permissions, immutable version retention, denied retention shortening/deletion including behavior of unversioned delete markers, with a disposable synthetic checkpoint.
4. Prove offline credential snapshot restore with historical keys, followed by approved full Console/Postgres/hosting/file/mail recovery in an existing isolated environment; record RPO/RTO and original Production protected.
5. Independently approve checkpoint cadence, last-known-good pointer and monitoring. Old valid artifacts do not protect events created after the last receipt.

No Production changes, provider forms, supplier execution, credential readbacks, active customer provisioning or Neon migrations are authorized.

References:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-configure.html
- https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
