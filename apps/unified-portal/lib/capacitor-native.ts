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

  try {
    const specifier = '@capacitor/microphone';
    // @ts-ignore — optional plugin; loaded only on native
    const mod = await import(/* webpackIgnore: true */ specifier);
    const plugin = mod?.Microphone;
    if (!plugin || typeof plugin.requestPermissions !== 'function') {
      // Plugin missing in the wrapper — best-effort: let getUserMedia try.
      return { status: 'prompt' };
    }

    const check = typeof plugin.checkPermissions === 'function'
      ? await plugin.checkPermissions().catch(() => null)
      : null;

    if (check?.microphone === 'granted') return { status: 'granted' };
    if (check?.microphone === 'denied') {
      return { status: 'denied', canOpenSettings: true };
    }

    const res = await plugin.requestPermissions();
    if (res?.microphone === 'granted') return { status: 'granted' };
    if (res?.microphone === 'denied') {
      return { status: 'denied', canOpenSettings: true };
    }
    return { status: 'prompt' };
  } catch {
    // Plugin import failed — treat as unavailable so the web path still works.
    return { status: 'unavailable' };
  }
}

/**
 * Deep-link into the iOS Settings app at the OpenHouse entry so the agent
 * can flip the microphone switch without hunting for it. Falls back to a
 * no-op if the App plugin is not installed.
 */
export async function openNativeSettings(): Promise<boolean> {
  try {
    const specifier = '@capacitor/app';
    // @ts-ignore
    const mod = await import(/* webpackIgnore: true */ specifier);
    const App = mod?.App;
    if (App && typeof App.openSettings === 'function') {
      await App.openSettings();
      return true;
    }
  } catch {
    /* no-op */
  }
  return false;
}
