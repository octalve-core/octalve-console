"use strict";
// Verification is a display-only record of an authenticated external readback.
// Never confuse it with a permission to change DNS records or purchase domains.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const api=read("backend/providers/connection_views.py");
const status=read("backend/providers/connection_status.py");
const verifier=read("backend/providers/connection_verification.py");
const card=read("frontend/src/features/admin/integrations/ProviderCard.tsx");
const sheet=read("frontend/src/features/admin/integrations/ProviderSideSheet.tsx");
const action=read("frontend/src/features/admin/integrations/SavedConnectionActions.tsx");
const contract=read("frontend/src/features/admin/integrations/connection-readback.ts");
assert.ok(api.includes("verification_receipts(rows[:50])")&&
 api.includes("safe_verification_status(row,receipts or {})"));
assert.ok(status.includes('details__verified=True')&&
 status.includes('details__read_only=True')&&
 status.includes('details__execution_enabled=False')&&
 status.includes('details["credential_version"]!=row.current_version')&&
 status.includes('receipt["entity_name"]!=row.adapter_key'));
assert.ok(verifier.includes('"verified":True,"read_only":True,"execution_enabled":False'));
assert.ok(contract.includes("verification_status")&&contract.includes("last_verified_at"));
assert.ok(card.includes('c.verification_status==="verified"')&&
 card.includes('c.verification_status==="recheck_required"')&&
 card.includes('c.state==="revoked"'));
assert.ok(sheet.includes('c.verification_status==="verified"')&&
 sheet.includes('Last verified:')&&
 sheet.includes('onVerified={onSaved}'));
assert.ok(action.includes('onVerified?.()')&&
 action.includes('result.execution_enabled!==false'));
assert.ok(!/localStorage|sessionStorage|NEXT_PUBLIC_/.test(action));
console.log("PASS: verified status follows retained matching evidence only; no write authority or secret persistence added.");
