export type ActionVariant="primary"|"secondary"|"outline"|"ghost"|"danger";
export type ActionSize="sm"|"md"|"lg";
export const actionBase="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const actionVariants:Record<ActionVariant,string>={
 primary:"bg-console-primary text-white hover:bg-console-hover",
 secondary:"bg-console-sidebar text-white hover:bg-slate-800",
 outline:"border border-slate-300 bg-white text-console-ink hover:bg-slate-50",
 ghost:"bg-transparent text-console-ink hover:bg-slate-100",
 danger:"bg-rose-600 text-white hover:bg-rose-700"
};
export const actionSizes:Record<ActionSize,string>={
 sm:"h-10 px-3 text-sm",md:"h-12 px-5 text-sm",lg:"h-14 px-6 text-base"
};
