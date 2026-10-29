import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Batch 8: one TypeScript Tailwind configuration. Keep historical feature
    // globs to preserve prior regression contracts; the catch-all covers every view.
    "./src/features/support/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/staff/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/admin/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Semantic, opt-in typography: preserve legacy route font sizes until
      // individually qualified, but give new primitives one documented scale.
      fontFamily: {
        "console": ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        "console-caption": ["0.75rem", { lineHeight: "1.125rem" }],
        "console-body": ["0.875rem", { lineHeight: "1.5rem" }],
        "console-section": ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.025em" }],
        "console-page": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.025em" }],
      },
      // Legacy utility aliases render at medium weight while source migration proceeds.
      fontWeight: { medium:"500", semibold:"500", bold:"500", extrabold:"500", black:"500" },
      // Opt-in premium layout tokens. Existing utility scales and route sizing
      // stay untouched until authenticated visual parity qualifies migration.
      spacing: {
        "page-gutter": "clamp(1rem, 2vw, 2rem)",
        "section": "2rem",
        "section-lg": "3rem",
      },
      maxWidth: {
        "console-content": "97.5rem",
        "console-reading": "48rem",
      },
      borderRadius: {
        "console-card": "1.5rem",
        "console-control": "0.875rem",
      },
      colors: {
        "octalve-blue": "#0064E0",
        "cloud-blue": "#0064E0",
        console: {
          primary: "#0064E0",
          hover: "#0052B8",
          ink: "#071425",
          muted: "#64748B",
          sidebar: "#000A16",
          canvas: "#F8FAFC",
          line: "#E5EBF3",
        },
      },
      boxShadow: {
        "soft": "0 18px 60px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  // Preserve core brand tokens in generated CSS even when a route is lazy-loaded.
  safelist: ["bg-console-primary", "text-console-ink", "border-console-line", "min-h-36"],
  plugins: [],
};

export default config;
