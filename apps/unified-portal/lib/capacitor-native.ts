'use client';

/**
 * Capacitor runtime helpers.
 *
 * `@capacitor/core`, `@capacitor/microphone` and friends are optional
 * dependencies — they are installed in the native wrapper repo, not in the
 * web bundle's package.json. To avoid webpack resolving them at build time
 * we use variable-string dynamic imports (the same trick as
 * `hooks/usePushNotifications.ts`). On the web the imports fail silently and
 * we fall through to the browser primitives.
 */

export type NativeMicPermissionResult =
  | { status: 'granted' }
  | { status: 'denied'; canOpenSettings: boolean }
  | { status: 'prompt' }
  | { status: 'unavailable' }; // not running native

let capacitorCache: any | undefined;

async function getCapacitor(): Promise<any | null> {
  if (capacitorCache !== undefined) return capacitorCache;
  try {
    const specifier = '@capacitor/core';
    // @ts-ignore — optional dep, dynamic to avoid webpack static resolution
    const mod = await import(/* webpackIgnore: true */ specifier);
    capacitorCache = mod?.Capacitor ?? null;
    return capacitorCache;
  } catch {
    capacitorCache = null;
    return null;
  }
}

export async function isCapacitorNative(): Promise<boolean> {
  const cap = await getCapacitor();
  return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
}

export async function getCapacitorPlatform(): Promise<'ios' | 'android' | 'web' | null> {
  const cap = await getCapacitor();
  if (!cap || typeof cap.getPlatform !== 'function') return null;
  const p = cap.getPlatform();
  return p === 'ios' || p === 'android' || p === 'web' ? p : null;
}

/**
 * Request microphone permission on the native platform BEFORE calling
 * `navigator.mediaDevices.getUserMedia`. On iOS, WKWebView will not present
 * the permission prompt on a cold start unless the native plugin has asked
 * first — `getUserMedia` just rejects with `NotAllowedError` (or, on older
 * iOS where `mediaDevices` is undefined, throws the "undefined is not an
 * object" crash we saw in Orla's report).
 *
 * Returns:
 *   - 'granted'     — safe to proceed to getUserMedia
 *   - 'denied'      — do not call getUserMedia; show Settings hint
 *   - 'prompt'      — plugin returned indeterminate; callers may try
 *                     getUserMedia which will itself prompt
 *   - 'unavailable' — not running on native (web/desktop); callers should
 *                     use the standard web path
 */
export async function requestMicrophonePermission(): Promise<NativeMicPermissionResult> {
  const native = await isCapacitorNative();
  if (!native) return { status: 'unavailable' };

  // Session 8 Bug 2 fix. Previous implementation always ran
  // `await import('@capacitor/microphone')`. When the plugin isn't
  // installed in the shell (the PWA-Capacitor config), the bare specifier
  // hits the WebView as an unresolved fetch — on iOS that can corrupt the
  // WebView's decide-policy state, causing subsequent relative-href taps
  // to be treated as external navigations and handed off to Mobile Safari.
  // Gate the `import()` behind a pre-check that the plugin is already
  // registered on `Capacitor.Plugins.Microphone`. If it isn't, never run
  // the bare-specifier import — just return 'unavailable' so the browser
  // path handles permission directly via getUserMedia.
  const cap = await getCapacitor();
  const preregistered = cap?.Plugins?.Microphone;
  if (!preregistered || typeof preregistered.requestPermissions !== 'function') {
    return { status: 'unavailable' };
  }

  try {
    const check = typeof preregistered.checkPermissions === 'function'
      ? await preregistered.checkPermissions().catch(() => null)
      : null;

    if (check?.microphone === 'granted') return { status: 'granted' };
    if (check?.microphone === 'denied') {
      return { status: 'denied', canOpenSettings: true };
    }

    const res = await preregistered.requestPermissions();
    if (res?.microphone === 'granted') return { status: 'granted' };
    if (res?.microphone === 'denied') {
      return { status: 'denied', canOpenSettings: true };
    }
    return { status: 'prompt' };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Deep-link into the iOS Settings app at the OpenHouse entry so the agent
 * can flip the microphone switch without hunting for it. Falls back to a
 * no-op if the App plugin is not installed.
 */
export async function openNativeSettings(): Promise<boolean> {
  // Same hardening as the mic path: only try the App plugin if it's
  // already on Capacitor.Plugins. Never emit a bare-specifier import
  // that could be interpreted as a network URL by the WebView.
  const cap = await getCapacitor();
  const App = cap?.Plugins?.App;
  if (!App || typeof App.openSettings !== 'function') return false;
  try {
    await App.openSettings();
    return true;
  } catch {
    return false;
  }
}
