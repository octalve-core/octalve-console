export const dataSourceConfig = {
  allowFallbackData:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ALLOW_FALLBACK_DATA === "true",
};

export function getFallbackData<T>(records: T[]): T[] {
  return dataSourceConfig.allowFallbackData ? records : [];
}

export function getApiOnlyNotice() {
  return "Information is currently unavailable. Please try again.";
}