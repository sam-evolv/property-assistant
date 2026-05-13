import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function importsOptionalPlugin(source, packageName) {
  const code = stripComments(source);
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const staticImport = new RegExp(`\\bimport\\s+(?:type\\s+)?[^;\\n]*['"]${escaped}['"]`);
  const directDynamicImport = new RegExp(`\\bimport\\s*\\(\\s*['"]${escaped}['"]`);
  const packageSpecifier = new RegExp(`\\b(?:const|let|var)\\s+\\w+\\s*=\\s*['"]${escaped}['"]`);
  return staticImport.test(code) || directDynamicImport.test(code) || packageSpecifier.test(code);
}

const manifest = parseJson('public/manifest.json');
assert(manifest.display === 'standalone', 'PWA manifest display must be standalone');
assert(manifest.orientation === 'portrait-primary', 'PWA manifest must stay portrait-primary');
assert(manifest.start_url === '/', 'PWA manifest start_url must remain /');
assert(Array.isArray(manifest.icons), 'PWA manifest icons must be an array');
assert(manifest.icons.some((icon) => icon.sizes === '192x192'), 'PWA manifest must include a 192x192 icon');
assert(manifest.icons.some((icon) => icon.sizes === '512x512'), 'PWA manifest must include a 512x512 icon');

parseJson('public/.well-known/assetlinks.json');
parseJson('public/.well-known/apple-app-site-association');

const sw = read('public/sw.js');
assert(sw.includes("self.addEventListener('install'"), 'Service worker must handle install');
assert(sw.includes("self.addEventListener('activate'"), 'Service worker must handle activate');
assert(sw.includes("self.addEventListener('fetch'"), 'Service worker must handle fetch');
assert(sw.includes("url.pathname.startsWith('/care')"), 'Service worker must keep care route handling explicit');
assert(sw.includes("event.request.mode === 'navigate'"), 'Service worker must provide a navigation offline fallback');

const swRegister = read('app/care/sw-register.tsx');
assert(swRegister.includes("navigator.serviceWorker.register('/sw.js')"), 'Care app must register /sw.js');

const layout = read('app/layout.tsx');
assert(layout.includes("manifest: '/manifest.json'"), 'Root metadata must reference /manifest.json');
assert(layout.includes('apple-mobile-web-app-capable'), 'Root layout must include iOS web-app capability meta');
assert(layout.includes("viewportFit: 'cover'"), 'Viewport must use viewportFit cover for native/PWA safe areas');

const androidManifest = read('android/app/src/main/AndroidManifest.xml');
assert(androidManifest.includes('android:usesCleartextTraffic="false"'), 'Android wrapper must reject cleartext traffic');
assert(androidManifest.includes('android:allowBackup="false"'), 'Android wrapper must disable backups');
assert(androidManifest.includes('android:screenOrientation="portrait"'), 'Android wrapper must stay portrait');
assert(androidManifest.includes('android.permission.INTERNET'), 'Android wrapper must keep internet permission');

const iosPlist = read('ios/App/App/Info.plist');
assert(iosPlist.includes('UIInterfaceOrientationPortrait'), 'iOS wrapper must support portrait');
assert(!iosPlist.includes('UIInterfaceOrientationLandscapeLeft'), 'iOS wrapper must not support landscape left');
assert(!iosPlist.includes('UIInterfaceOrientationLandscapeRight'), 'iOS wrapper must not support landscape right');
assert(iosPlist.includes('NSMicrophoneUsageDescription'), 'iOS wrapper must describe microphone usage');
assert(iosPlist.includes('NSCalendarsWriteOnlyAccessUsageDescription'), 'iOS wrapper must describe calendar write usage');

const capacitorNative = read('lib/capacitor-native.ts');
assert(capacitorNative.includes('Capacitor.Plugins?.Microphone') || capacitorNative.includes('cap?.Plugins?.Microphone'), 'Microphone bridge must use registered Capacitor plugins');
assert(!importsOptionalPlugin(capacitorNative, '@capacitor/microphone'), 'Microphone bridge must not import a bare optional plugin module at runtime');

const push = read('hooks/usePushNotifications.ts');
assert(push.includes('Capacitor.Plugins?.PushNotifications'), 'Push bridge must use registered Capacitor plugins');
assert(!importsOptionalPlugin(push, '@capacitor/push-notifications'), 'Push bridge must not import a bare optional plugin module at runtime');
assert(push.includes('tryWebPush'), 'Push bridge must keep the web push fallback');

console.log('PWA/Capacitor audit passed');
