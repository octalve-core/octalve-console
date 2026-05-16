export const runtimeConfig = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "development",
  nodeEnv: process.env.NODE_ENV ?? "development",
};

export type RuntimeCheck = {
  key: string;
  label: string;
  value: string;
  ready: boolean;
  description: string;
};

export function getRuntimeChecks(): RuntimeCheck[] {
  return [
    {
      key: "api-base-url",
      label: "API base URL",
      value: runtimeConfig.apiBaseUrl || "Missing",
      ready: Boolean(runtimeConfig.apiBaseUrl),
      description: "Required for Django API communication.",
    },
    {
      key: "app-url",
      label: "App URL",
      value: runtimeConfig.appUrl || "Missing",
      ready: Boolean(runtimeConfig.appUrl),
      description: "Used for frontend links, redirects, and production configuration.",
    },
    {
      key: "app-version",
      label: "App version",
      value: runtimeConfig.appVersion,
      ready: Boolean(runtimeConfig.appVersion),
      description: "Optional label for release tracking.",
    },
    {
      key: "node-env",
      label: "Node environment",
      value: runtimeConfig.nodeEnv,
      ready: Boolean(runtimeConfig.nodeEnv),
      description: "Confirms whether the app is running in development or production mode.",
    },
  ];
}