export const APP_TARGET =
  process.env.NEXT_PUBLIC_APP_TARGET === "ios" ? "ios" : "web";

export const isIOS = APP_TARGET === "ios";
