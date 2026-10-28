/** Explicit review register: source presence is not operational certification.
 * No boolean in this file can verify database, payment, recovery or browsers.
 * Only separately signed external qualification can change these states.
 */
export type ProductionReadinessCheck = {
  group: "Architecture" | "API" | "Security" | "UX" | "Build" | "Operations";
  label: string;
  status: "Review" | "Pending" | "Blocked";
  description: string;
};
export const productionReadinessChecks: ProductionReadinessCheck[] = [
 {group:"Architecture",label:"Feature-based frontend",status:"Review",description:"Modules exist in source; access and interactions require browser acceptance."},
 {group:"Architecture",label:"Route source inventory",status:"Review",description:"135 page files tracked from Git. This is not proof they were audited."},
 {group:"API",label:"API contract coverage",status:"Pending",description:"Paths are source-mapped; runtime HTTP outcomes, ownership, serializer parity and errors are not fully attested."},
 {group:"API",label:"Demo fallback isolation",status:"Review",description:"Sample data is development-only; verify malformed envelopes and retry behavior separately."},
 {group:"API",label:"Create/edit serializer parity",status:"Pending",description:"Generic Products and Plans writers are blocked; validate all other request/response contracts."},
 {group:"Security",label:"Authenticated role acceptance",status:"Pending",description:"Server-side role checks exist; browser denial and session testing are not signed."},
 {group:"Security",label:"Payments and supplier actions",status:"Blocked",description:"Financial settlement and supplier-changing provisioning are intentionally disabled pending external qualification."},
 {group:"UX",label:"Responsive browser qualification",status:"Pending",description:"135 routes × 6 viewports = 810 cases; source/build checks cannot certify visual acceptance."},
 {group:"Build",label:"Exact-head frontend and Django CI",status:"Review",description:"Review GitHub checks against the deployed exact SHA; this page has no trusted CI attestation source."},
 {group:"Operations",label:"Production database and migration parity",status:"Pending",description:"Public health checks liveness only; independent DB readback and migration evidence required."},
 {group:"Operations",label:"External KMS, WORM recovery, gateways and vendors",status:"Blocked",description:"Certification requires independent custody, real restore drill and provider-approved sandbox evidence."},
];
