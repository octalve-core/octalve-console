/**
 * Read-only presentation adapters for existing Django reporting endpoints.
 * Deliberately reject malformed shapes: report UI must not turn unknown
 * financial data into fabricated zeros or mixed-currency NGN totals.
 */
export type CategoryCount = { label: string; count: number };
export type ReportDefinitionCard = {
  id: string; name: string; description: string; kind: string; active: boolean | null;
  frequency: string; lastGenerated: string | null;
};
export type ReportInstanceCard = {
  id: string; title: string; status: string; format: string; generatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an authorized report record.");
  }
  return value as Record<string, unknown>;
}

function list(value: unknown): Record<string, unknown>[] {
  const candidate = Array.isArray(value) ? value : asRecord(value).results;
  if (!Array.isArray(candidate)) throw new Error("Unexpected reporting list response.");
  return candidate.map(asRecord);
}
function label(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function id(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  throw new Error("Report record has no valid identifier.");
}
function count(value: unknown): number {
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isSafeInteger(numeric) || numeric < 0) throw new Error("Invalid reporting count.");
  return numeric;
}
export function parsePaidInvoiceCount(value: unknown): number {
  return count(asRecord(value).invoice_count);
}
export function parseGatewayCounts(value: unknown): CategoryCount[] {
  return list(value).map(x=>({
    label:label(x["gateway__name"], "Unspecified gateway"),
    count:count(x.count),
  })).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
}
export function parseProductCounts(value: unknown): CategoryCount[] {
  return list(value).map(x=>({
    label:label(x.description, "Unspecified invoice item"),
    count:count(x.count),
  })).sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
}
export function parseDefinitions(value: unknown): ReportDefinitionCard[] {
  return list(value).map(x=>({
    id:id(x.id),
    name:label(x.name,"Unnamed report"),
    description:label(x.description,"Report definition"),
    kind:label(x.report_type_display,label(x.report_type,"Report")),
    active:typeof x.is_active === "boolean" ? x.is_active : null,
    frequency:label(x.frequency_display,label(x.frequency,"On demand")),
    lastGenerated:typeof x.last_generated_at==="string"?x.last_generated_at:null,
  }));
}
export function parseInstances(value: unknown): ReportInstanceCard[] {
  return list(value).map(x=>({
    id:id(x.id),
    title:label(x.title,label(x.definition_name,"Report")),
    status:label(x.status,"unknown"),
    format:label(x.file_format,"—"),
    generatedAt:typeof x.generated_at==="string"?x.generated_at:null,
  }));
}
