import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strictNativeBuilds = process.env.STRICT_NATIVE_BUILDS === 'true';
const githubActions = process.env.GITHUB_ACTIONS === 'true';

const requiredMetadata = [
  'public/manifest.json',
  'public/sw.js',
  'public/.well-known/assetlinks.json',
  'public/.well-known/apple-app-site-association',
  'android/app/src/main/AndroidManifest.xml',
  'ios/App/App/Info.plist',
  'hooks/usePushNotifications.ts',
  'lib/capacitor-native.ts',
  'docs/MOBILE_RELEASE_QA.md',
];

const nativeBuildProjects = {
  android: [
    'android/settings.gradle',
    'android/build.gradle',
    'android/gradlew',
    'android/app/build.gradle',
    'android/gradle/wrapper/gradle-wrapper.properties',
  ],
  ios: [
    'ios/App/Podfile',
    'ios/App/App.xcodeproj/project.pbxproj',
  ],
};

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  if (githubActions) {
    console.error(`::error::${message}`);
  }
  throw new Error(message);
}

function warn(message) {
  if (githubActions) {
    console.warn(`::warning::${message}`);
  } else {
    console.warn(`Warning: ${message}`);
  }
}

const missingMetadata = requiredMetadata.filter((file) => !exists(file));
if (missingMetadata.length > 0) {
  fail(`Missing mobile release metadata: ${missingMetadata.join(', ')}`);
}

const qa = read('docs/MOBILE_RELEASE_QA.md');
for (const heading of [
  'Install and Launch',
  'Authentication',
  'Assistant and Property Workflows',
  'Native Capabilities',
  'Offline and Recovery',
  'Release Sign-off',
]) {
  if (!qa.includes(heading)) {
    fail(`Mobile QA checklist is missing the ${heading} section`);
  }
}

const missingNative = Object.entries(nativeBuildProjects).flatMap(([platform, files]) =>
  files.filter((file) => !exists(file)).map((file) => `${platform}: ${file}`)
);

if (missingNative.length > 0) {
  const message = `Native build projects are incomplete, so CI cannot yet create real Android/iOS artifacts: ${missingNative.join(', ')}`;
  if (strictNativeBuilds) {
    fail(message);
  }
  warn(message);
} else {
  console.log('Native build project files are present. Add platform build jobs for ./gradlew assembleDebug and xcodebuild archive next.');
}

console.log('Mobile release readiness audit completed');
