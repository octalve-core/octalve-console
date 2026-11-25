export const semanticSurfaces = {
  blue: "border-blue-200 bg-[#e3edff] text-blue-900",
  amber: "border-amber-200 bg-[#fff0da] text-amber-950",
  violet: "border-violet-200 bg-[#ede7ff] text-violet-950",
  green: "border-emerald-200 bg-[#ddf5e9] text-emerald-950",
  rose: "border-rose-200 bg-[#fce5eb] text-rose-950",
  cyan: "border-cyan-200 bg-[#dff3fc] text-cyan-950",
  slate: "border-slate-200 bg-slate-100 text-slate-900",
} as const;

export type SemanticTone = keyof typeof semanticSurfaces;
