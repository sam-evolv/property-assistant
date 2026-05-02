/**
 * BUG-15 — voice input feedback. Cross-platform haptic helper for the
 * mic press / release cycle. Voice-first surfaces depend on a clear
 * tactile beat to confirm "I'm listening" / "I stopped"; without one,
 * the user has to watch the screen to confirm the tap registered.
 *
 * Strategy:
 *   1. Try Capacitor Haptics (native iOS + Android via the plugin) when
 *      it's installed. Dynamic import so the web bundle never tries to
 *      pull in the Capacitor runtime when the package isn't present.
 *   2. Fall back to navigator.vibrate(15) — works on Android Chrome /
 *      Firefox, silently no-ops on iOS Safari and desktop. Harmless.
 *   3. Swallow any failure. Haptics are additive; the rest of the
 *      mic flow must keep working.
 *
 * NOTE: at the time of writing, @capacitor/haptics is NOT in any
 * package.json in this repo. The dynamic import returns null on the
 * web bundle and the helper falls through to navigator.vibrate. When
 * the Capacitor build adds the plugin later, this helper picks it up
 * automatically — no call-site change needed.
 */

type ImpactStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY';

async function loadCapacitorHaptics(): Promise<{
  Haptics: { impact: (opts: { style: any }) => Promise<void> };
  ImpactStyle: Record<string, any>;
} | null> {
  try {
    // Use a string variable so esbuild / webpack don't statically
    // resolve the module path when the package isn't installed.
    const moduleId = '@capacitor/haptics';
    const mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ moduleId);
    if (!mod?.Haptics?.impact || !mod?.ImpactStyle) return null;
    return mod as any;
  } catch {
    return null;
  }
}

let cachedHaptics: Awaited<ReturnType<typeof loadCapacitorHaptics>> | undefined;

export async function lightImpact(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (cachedHaptics === undefined) {
    cachedHaptics = await loadCapacitorHaptics();
  }
  if (cachedHaptics?.Haptics?.impact && cachedHaptics?.ImpactStyle) {
    try {
      await cachedHaptics.Haptics.impact({ style: cachedHaptics.ImpactStyle.Light });
      return;
    } catch {
      /* fall through to web vibrate */
    }
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(15);
    }
  } catch {
    /* additive — never throw */
  }
}

export type { ImpactStyle };
