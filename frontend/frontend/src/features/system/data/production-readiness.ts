export type ProductionReadinessCheck = {
  group: "Architecture" | "API" | "Security" | "UX" | "Build";
  label: string;
  status: "Ready" | "Review" | "Pending";
  description: string;
};

export const productionReadinessChecks: ProductionReadinessCheck[] = [
  {
    group: "Architecture",
    label: "Feature-based frontend structure",
    status: "Ready",
    description: "Admin, client, staff, auth, system, and navigation features are separated for easier growth.",
  },
  {
    group: "Architecture",
    label: "Thin app route files",
    status: "Ready",
    description: "Most pages now import feature views instead of carrying large page-level code.",
  },
  {
    group: "API",
    label: "OpenAPI-aligned API module layer",
    status: "Ready",
    description: "schemaApi and module files keep API calls grouped by backend responsibility.",
  },
  {
    group: "API",
    label: "Fallback data strategy",
    status: "Ready",
    description: "Pages remain usable when the local Django API is unavailable.",
  },
  {
    group: "API",
    label: "Final payload confirmation",
    status: "Review",
    description: "Some create/edit forms are UI-ready but should be matched against the backend's final serializer payloads.",
  },
  {
    group: "Security",
    label: "Role-based route guards",
    status: "Ready",
    description: "Admin, client, and staff layouts are protected with role checks.",
  },
  {
    group: "Security",
    label: "JWT authentication flow",
    status: "Ready",
    description: "Login, signup, current user, and logout flow through the Django auth API layer.",
  },
  {
    group: "UX",
    label: "Modern dashboard shell",
    status: "Ready",
    description: "Dark sidebar, soft dashboard background, premium cards, mobile navigation, and consistent topbar are active.",
  },
  {
    group: "UX",
    label: "Responsive mobile layouts",
    status: "Ready",
    description: "Core admin, client, and staff pages use responsive Tailwind grid and stacked mobile layouts.",
  },
  {
    group: "Build",
    label: "TypeScript build",
    status: "Ready",
    description: "tsc and Next production build should pass before merging to main.",
  },
  {
    group: "Build",
    label: "Legacy backup files removed",
    status: "Ready",
    description: "Backup .tsx files inside src are removed because Next may compile them.",
  },
];