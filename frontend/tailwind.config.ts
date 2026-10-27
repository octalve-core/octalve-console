import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Batch 5 support sections must be scanned by the production build.
    "./src/features/support/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/staff/**/*.{js,ts,jsx,tsx,mdx}",
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
  // Foundation components are intentionally not mounted before Batch 2.
  // Preserve only these essential token utilities in the production CSS bundle.
  safelist: ["bg-console-primary", "text-console-ink", "border-console-line", "min-h-36"],
  plugins: [],
};

export default config;
