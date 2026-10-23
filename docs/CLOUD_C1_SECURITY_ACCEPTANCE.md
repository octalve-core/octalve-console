# Octalve Cloud C1 — acceptance and security gates
Evidence required per gate: command or browser journey, branch/commit SHA, result, and test environment. None of these checkboxes is passed merely because the checklist exists.

### Review branch tests
- [ ] `python -m compileall -q backend` passes.
- [ ] `cd backend && python -m unittest discover -s tests -p 'test_*.py' -v` passes.
- [ ] Missing or malformed provider webhook secret/signature rejects with 401, no persisted event.
- [ ] Paystack HMAC-SHA512 verifies original **raw** body and rejects altered body.
- [ ] Flutterwave v3 uses `verif-hash`; v4 requires a separately versioned HMAC-SHA256 handler.
- [ ] Correctly signed duplicate webhook does not settle or create duplicate event records.
- [ ] Verified event stays `is_processed=False` and `pending_reconciliation`.
- [ ] Redirect payment verify cannot create success without amount, currency, reference and merchant verification.
- [ ] Client cannot initiate/retry/cancel/mark privileged provisioning task. Staff needs `manage_provisioning`.
- [ ] Client cannot create/update/delete commercial Service or payment gateway settings.
- [ ] Provider logs contain neither passwords nor raw request/response payloads.
- [ ] Invoice post-save signal loads timezone and service generation validated on real test database.

### Full integration release blockers
- [ ] PostgreSQL migration on isolated review DB and data persistence after redeploy.
- [ ] Django negative permissions matrix for admin, staff, client A, client B.
- [ ] Actual Django signup/login/logout/current-user, reset and cookie/session tests.
- [ ] Console no-fictional-record policy in all list, detail and edit views.
- [ ] Atomic gateway reconciliation validates amount/currency/reference; one invoice and transaction under repeated callbacks.
- [ ] Durable provisioning worker with lease, retry, idempotency and observable exception state.
- [ ] Frontend typecheck/build and Django `check --deploy` pass.
- [ ] Browser E2E test running against deployed frontend plus actual Django/API and isolated DB.
- [ ] Docker-compatible self-host migration and tested DB restore completed.
- [ ] Review owner approves final release; no production payment or customer hosting initiated by C1.

**C1 is a security foundation, not a completed payment, provisioning, OPanel or public hosting launch.**
