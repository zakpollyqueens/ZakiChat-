# Molan Chat Android project

This module packages the existing Molan Chat web application inside an Android WebView and adds a native draggable floating bubble.

## Current implementation
- Native Android launcher activity that serves bundled web assets on the local HTTPS origin `https://zakichat.local`.
- Glossy cyan/navy ZAK floating bubble, initially positioned at the vertical center-right of the screen.
- Drag-to-move behavior and an expandable panel loading the existing Chats page.
- Floating-bubble setting in Molan Chat Settings, with a native bridge to Android's overlay permission.
- The existing chat list sorts conversations with unread chats first, then pinned chats, then latest activity.
- The foreground service is started while the app is visible, hides the bubble while Molan Chat is open, and shows it when the app moves to the background.
- The bubble service is configured to stop when Android reports the app task was removed from Recents.

## Compatibility note
The existing Android application ID and local WebView origin are intentionally retained in this first branding pass so current installations, deep links, and sign-in/session storage are not disrupted. A package-ID migration requires a separately planned release.

## Build
The workflow `.github/workflows/build-android-apk.yml` copies the website into Android assets, builds the Android APKs, and publishes direct APK assets on the `zc-vr15-android` GitHub Release.

For local builds, install JDK 17, Android SDK Platform 35, Build Tools 35.0.0, and Gradle 8.9. From the repository root, copy the website into `android/app/src/main/assets/` while excluding `.git`, `.github`, `android`, and `supabase`, then run:

```sh
gradle -p android assembleDebug assembleRelease
```

## Test-build signing
The CI release variant is signed with the generated Android debug key only to make the test APK directly installable. It is not a production signing setup. A stable private keystore must be configured securely before distributing production updates. Because the CI debug key is ephemeral, uninstall an earlier test APK if Android rejects an update due to a signature mismatch.

## Device checks still required
Test sign-in, message loading, avatar rendering, overlay permission, background behavior, swiping Molan Chat away from Recents, and behavior on the target Android device. Android/OEM background policies can vary.
