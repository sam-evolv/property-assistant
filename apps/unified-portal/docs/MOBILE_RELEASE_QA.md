# Mobile Release QA

Use this checklist before showing the iOS or Android app to customers, investors, partners, or field teams. Cloud checks can prove the PWA and wrapper metadata are coherent; real confidence still needs device passes because permissions, push delivery, offline behaviour, and installed-app navigation depend on the OS.

## Install and Launch

- Install the latest Android build on a clean physical Android device.
- Install the latest iOS build through TestFlight on a clean physical iPhone.
- Launch from the home screen and confirm the app opens without a browser address bar.
- Force quit and relaunch; the last valid app route should recover cleanly.
- Rotate the device and confirm the app remains in the intended portrait experience.

## Authentication

- Sign in as a known valid test user.
- Sign out, close the app, relaunch, and confirm the signed-out state is stable.
- Try an expired or invalid session and confirm the user is returned to sign-in without a blank screen.
- Confirm passwordless, magic-link, or redirect flows return to the installed app where supported.

## Assistant and Property Workflows

- Open the assistant and send a normal property question.
- Confirm assistant responses render, scroll, and preserve context after backgrounding the app.
- Open a property/viewing flow and complete the primary expected action.
- Confirm loading, empty, and error states are understandable on mobile width.
- Verify key screens with poor connectivity or server errors do not trap the user.

## Native Capabilities

- Grant microphone permission and confirm voice input either works or fails with a clear fallback.
- Deny microphone permission and confirm the rest of the assistant remains usable.
- Add a viewing to the calendar and confirm the OS permission prompt, event title, date, and time.
- Enable notifications and confirm the device token is registered server-side.
- Tap a delivered notification and confirm it opens the correct app route.

## Offline and Recovery

- Launch once online, then enable airplane mode and reopen the app.
- Confirm the service worker fallback is shown for unavailable network routes.
- Restore connectivity and confirm the app recovers without requiring reinstall.
- Confirm stale cached content cannot expose the wrong user's data after sign-out/sign-in.

## Release Sign-off

- Android physical device pass recorded with OS version, device model, build number, tester, and date.
- iOS physical device pass recorded with OS version, device model, TestFlight build number, tester, and date.
- Push notification, microphone, and calendar permission results recorded for both allow and deny paths.
- Any failed item has a linked issue or PR before wider sharing.
- Store identifiers, signing certificates, asset links, and Apple app-site association values are checked against the intended production app IDs.
