/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Batch 5 support sections must be scanned by the production build.
    "./src/features/support/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/staff/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/admin/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "octalve-blue": "#0064E0",
        "cloud-blue": "#0064E0",
        console: {
          primary: "#0064E0", hover: "#0052B8", ink: "#071425",
          muted: "#64748B", sidebar: "#000A16",
          canvas: "#F8FAFC", line: "#E5EBF3",
        },
      },
    },
  },
  // Unmounted Batch 1 primitives still need their key utility rules.
  safelist: ["bg-console-primary", "text-console-ink", "border-console-line", "min-h-36"],
  plugins: [],
}