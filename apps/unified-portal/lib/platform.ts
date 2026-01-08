export const isIOS =
  typeof window !== "undefined" &&
  (window as any).Capacitor?.getPlatform?.() === "ios";
