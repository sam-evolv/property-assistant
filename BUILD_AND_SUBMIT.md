# BUILD_AND_SUBMIT — OpenHouse Agent iOS (Capacitor)

This is the exact command sequence to turn the Session 6B fixes into a
TestFlight / App Store build. The web-side fixes are merged in this repo; the
Capacitor wrapper (Xcode project, `Info.plist`, `Podfile`) lives in the
separate iOS repo and these steps have to be run there on a Mac with Xcode
installed.

## Prerequisites

- Xcode 15+ and Command Line Tools installed
- A valid Apple Developer account signed into Xcode
- The Agent app's distribution signing cert + provisioning profile already
  imported
- `cocoapods` installed (`sudo gem install cocoapods`)
- `@openhouse/unified-portal` built and ready (`npm run build` in this repo
  produces the static bundle consumed by the Capacitor wrapper — verify
  before starting)

## Step 1 — Install the microphone plugin

In the **iOS wrapper repo** (the one with `ios/App/Podfile` — NOT this repo):

```bash
npm install @capacitor/microphone @capacitor/app
```

Both plugins are used by the new `lib/capacitor-native.ts` helper:
`@capacitor/microphone` for the permission prompt, `@capacitor/app` for the
`openSettings()` deep-link. They are declared optional on the web side
(dynamic imports), so they only need to exist in the wrapper.

## Step 2 — Update Info.plist

Open `ios/App/App/Info.plist` in the wrapper repo and add the permission
strings. These must be present BEFORE the app ships — iOS will reject
`getUserMedia` silently if the usage description is missing.

```xml
<key>NSMicrophoneUsageDescription</key>
<string>OpenHouse needs microphone access to capture your voice notes for drafting emails and updating your pipeline.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>OpenHouse uses on-device speech recognition to give you live captions while you dictate.</string>
```

If the app ever asks for the camera later, add `NSCameraUsageDescription`
too — not required for this session.

## Step 3 — Bump version and build number

Open `ios/App/App.xcodeproj` → App target → General → Identity.

- **Version** — bump the marketing version (e.g. `1.2.3` → `1.2.4`)
- **Build** — increment the build number (each TestFlight upload requires a
  unique build number for the given version)

Alternatively, edit `Info.plist` directly:

```xml
<key>CFBundleShortVersionString</key>
<string>1.2.4</string>
<key>CFBundleVersion</key>
<string>42</string>
```

## Step 4 — Sync web bundle into the Capacitor iOS project

From the wrapper repo root:

```bash
# Pull the latest web build (this repo, main branch, after 6B merges)
npm run build:web     # wrapper-specific; see wrapper repo README

# Copy the web assets + plugins into ios/
npx cap sync ios

# Install / refresh CocoaPods
cd ios/App
pod install
cd ../..
```

`cap sync ios` does three things: copies the web bundle into
`ios/App/public/`, updates the native bridge for any new plugins
(`@capacitor/microphone`, `@capacitor/app`), and regenerates the Podfile
entries. Without this step the new permission flow won't be wired up.

## Step 5 — Open Xcode, clean, build, archive

```bash
npx cap open ios
```

In Xcode:

1. **Product → Clean Build Folder** (Shift+Cmd+K) — avoids stale plugin
   caches.
2. Select **Any iOS Device (arm64)** as the build target (not a simulator).
3. **Product → Archive**. Wait for the build to complete and the Organizer
   window to open.

## Step 6 — Distribute to TestFlight

In the Organizer:

1. Select the newly created archive.
2. **Distribute App** → **App Store Connect** → **Upload**.
3. Leave all options at their defaults unless the distribution team says
   otherwise (Strip Swift Symbols: on; Upload Symbols: on).
4. Re-authenticate with the Apple ID if prompted.
5. Wait for the upload to complete.

TestFlight will email the build to registered testers once Apple finishes
processing (usually 5–15 minutes).

## Step 7 — Smoke test on a real device

The fixes in this session only verify on-device. After the build lands on
TestFlight:

- [ ] Tap the mic in Intelligence → iOS presents the permission prompt on
      first use. Grant → waveform animates, transcript returns.
- [ ] Deny the permission. Banner shows "Microphone access is needed…" with
      an "Open Settings" pill. Tapping the pill jumps to OpenHouse's
      Settings entry.
- [ ] Open any draft on mobile. Only ONE header is visible (the panel's
      "SOLICITOR CHASE / recipient" header). No OPENHOUSE wordmark peeking
      through.
- [ ] Swipe a draft row left OR right, release mid-swipe. Row snaps back
      to 0. Tapping anywhere else on the list also snaps it back.
- [ ] Pull the drafts list down past the threshold. "Release to refresh"
      shows while held. On release the banner transitions straight to
      "Refreshing…" and dismisses cleanly when the fetch resolves.
- [ ] Pull the list but don't release past the threshold — banner returns
      to idle state, no hang.

## Notes

- The web fixes are already safe on desktop / mobile Safari. The Capacitor
  plugin dynamic imports fall through to `status: 'unavailable'` on web, so
  `getUserMedia` uses the standard browser prompt.
- If the mic still fails AFTER this build ships, check:
  1. `Info.plist` actually contains `NSMicrophoneUsageDescription` (verify
     on-device via `ipa-info` or by reading the installed bundle).
  2. `Capacitor.isNativePlatform()` returns true — the splash must hand off
     to the WKWebView, not Safari.
  3. The Settings → OpenHouse → Microphone toggle is ON.
- Don't reuse an old archive. A fresh `cap sync` + archive is required for
  the plugin wiring to land.
