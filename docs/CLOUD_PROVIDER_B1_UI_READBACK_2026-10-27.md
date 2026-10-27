# B1.2 — Admin side-sheet connection draft readback
Baseline `d24fb436cf1d79547e85a23f00cfb2f7b7a02ba6` (PR #58 merged), issue #54. No new API endpoints.

The Integration Store uses existing Admin-only, same-origin BFF endpoints `GET /providers/connections/` and `GET /providers/connections/schemas/`. It displays an encrypted draft as **Draft saved / Unverified draft** or **Revoked**, without rendering actual ciphertext or credential values. When the B1 migration is not yet applied, it displays **Connection registry is not available yet** rather than inventing empty connection data.

No POST, PATCH, password field, supplier activation, credential rotation UI or new client token storage has been introduced. This UI does not claim a vendor is connected. Full MFA/step-up acceptance, worker network egress certification and real credential forms remain separate gated work.
