// Ambient shim for the optional native `canvas` dependency.
//
// `canvas` is intentionally NOT installed — it is externalized in
// next.config.js and loaded at runtime through a guarded dynamic import
// (`await import('canvas')` inside try/catch) that falls back to null when the
// module is absent. This declaration stops `tsc` from failing on that import
// while preserving the runtime-optional behaviour.
declare module 'canvas' {
  export function createCanvas(width: number, height: number): any;
  const _default: any;
  export default _default;
}
