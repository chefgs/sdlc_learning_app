# Mobile Package Creation & App Store Publishing Guide

This guide details how to build Android (`.apk` / `.aab`) and iOS (`.ipa`) packages from your Expo React Native application, along with the OS-specific requirements and pre-checks needed to publish your app on the Google Play Store and Apple App Store.

---

## 1. Cloud Packaging: Expo Application Services (EAS Build)

The easiest way to generate packages (especially for beginners) is **EAS Build**. It compiles your code on Expo's secure cloud servers, meaning **you do not need a Mac to build iOS packages, nor do you need Android Studio installed locally**.

### Step 1: Install EAS CLI
Install the command-line interface globally:
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
Log in using your free Expo developer account:
```bash
eas login
```

### Step 3: Configure EAS Build
Run the configuration command in your `/mobile` folder:
```bash
eas build:configure
```
This command generates an `eas.json` file in your project, defining your build profiles (development, preview, production).

### Step 4: Trigger Builds

*   **For Android Testing (`.apk`)**:
    Add a preview profile to `eas.json` configured with `"buildType": "apk"`. Then compile:
    ```bash
    eas build --platform android --profile preview
    ```
*   **For Android Play Store (`.aab`)**:
    ```bash
    eas build --platform android --profile production
    ```
*   **For iOS App Store / TestFlight (`.ipa`)**:
    ```bash
    eas build --platform ios --profile production
    ```

*Expo will output a direct download link or submit the build directly to App Store Connect / Google Play Console.*

---

## 2. Alternative: Local Native Building (Xcode & Android Studio)

If you prefer to compile the binaries locally on your computer, you must first eject the native project folders.

### Step 1: Generate Native Projects
Run the prebuild command in your `/mobile` folder:
```bash
npx expo prebuild
```
This generates the native `/android` and `/ios` directories.

### Step 2: Compile Android locally
1.  Open `/android` in **Android Studio**.
2.  Set up a **Keystore file** (used to digitally sign your app) via *Build > Generate Signed Bundle / APK*.
3.  Or compile via CLI:
    ```bash
    cd android
    ./gradlew assembleRelease  # Outputs APK for local testing
    ./gradlew bundleRelease    # Outputs AAB for Play Store upload
    ```

### Step 3: Compile iOS locally (macOS Only)
1.  Open `/ios/SocraticSDLCTutor.xcworkspace` in **Xcode**.
2.  Go to *Signing & Capabilities* and select your Apple Developer Team.
3.  Set active build scheme to *Any iOS Device (arm64)*.
4.  Select *Product > Archive* from the top menu.
5.  Once the archive finishes, click *Distribute App* to export the `.ipa` package.

---

## 3. OS-Specific Pre-Checks for App Store Publishing

### A. Google Play Store (Android)
To launch your app successfully on Android devices:

1.  **Play Console Account**: Register a developer account ($25 one-time registration fee).
2.  **App Bundle Requirement**: Google Play **no longer accepts `.apk` files** for new app submissions. You must submit `.aab` (Android App Bundle) format.
3.  **Target SDK**: Ensure your `app.json` has `targetSdkVersion` set to the latest Android SDK version required by Google (e.g. SDK 34 for Android 14).
4.  **Keystore Security**: Keep your signing Keystore file secure. If lost, you cannot update your app in the store. We recommend enabling **Google Play App Signing** to let Google manage this.
5.  **Privacy Policy**: Required. Because the learning app facilitates photo homework uploads (multimodal inputs), your policy must declare that user images are safely handled and processed.

### B. Apple App Store (iOS)
To launch your app successfully on iPhones/iPads:

1.  **Apple Developer Program**: Register an account ($99/year subscription).
2.  **Minimum Functionality (Guideline 4.2)**: Apple rejects simple websites wrapped inside webviews. Because our Expo React Native app uses native navigators, input state flows, and local checklists, it qualifies as a **fully functional native app**.
3.  **Privacy Declarations**: When uploading, Apple will ask you to detail what data your app collects. You must disclose if you store chat histories or user progress.
4.  **TestFlight Beta**: We recommend publishing to **TestFlight** first. This lets you distribute the app to 10,000 external testers using email addresses before submitting it to the official App Store review.
