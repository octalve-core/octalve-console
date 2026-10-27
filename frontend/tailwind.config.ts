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
