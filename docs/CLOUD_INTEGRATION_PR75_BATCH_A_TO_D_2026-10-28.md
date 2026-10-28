# Octalve Console — consolidated source merge review, 28 October 2026

Included ancestry: provider security and coherent recovery evidence PR #75, Batch A PR #76, Batch B PR #77, Batch C PR #78, Batch D PR #79.

## Hard stops

- Git automatic deployment from `main` is disabled in both frontend and backend `vercel.json` during source consolidation. Do not promote either Vercel project, deploy by reference, or change this setting without separate Production authorization and a controlled release checklist.
- No Production Neon migration, payment settlement, vendor credential entry, hosting provisioning, cancellation execution, WebAuthn rollout or key rotation is authorized by source merge.
- Provider connection credential mutations remain blocked on all deployed and non-DEBUG runtimes irrespective of synthetic test flags, even with an enrolled server-verified TOTP authenticator.
- This merge incorporates **coherent synthetic recovery evidence** from PR #75, including exact signed-audit checkpoint-vs-encrypted-snapshot equality, rejection of corruption and nonsecret evidence output. This is *not* full PostgreSQL disaster recovery or externally retained immutable/WORM archival.
- TOTP is not WebAuthn, static vault environment keys are not KMS custody, and application TLS allowlisting is not external network-level supplier egress certification.

## Integration qualification

CI must execute the complete consolidated test suite, including: `providers.test_recovery_evidence`, `providers.test_operational_release_hold`, `providers.test_batch_d_key_separation`, `providers.test_batch_d_release_guard`, all preexisting vault, signed-audit, WORM, KMS, egress, PostgreSQL, frontend API and Admin safety tests.

Keep all source acceptance notes; no independent browser screenshots are asserted by CI. The exact final PR SHA and the resulting `main` SHA are the release evidence.

## Follow-up certification gates

Independent external KMS and immutable WORM archive, genuinely verified WebAuthn with hardware/browser recovery, isolated full-system restoration, network-policy controlled supplier certification and authenticated Admin/Client visual checks remain incomplete.
