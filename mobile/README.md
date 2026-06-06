# Socratic SDLC Tutor: Mobile App Client (Expo)

This is the mobile application frontend for the Socratic SDLC Tutor app, built using **React Native & Expo**. It is optimized for beginners to run, test, and deploy without needing Xcode or Android Studio locally.

---

## 1. Quick Testing on Your Physical Phone (Expo Go)

Expo allows you to run this application live on your personal mobile device.

### Step 1: Install the Expo Go App
Download the **Expo Go** application onto your phone:
*   **iOS (iPhone)**: [App Store Link](https://apps.apple.com/us/app/expo-go/id1224867724)
*   **Android**: [Google Play Store Link](https://play.google.com/store/apps/details?id=host.exp.exponent)

### Step 2: Install Mobile Node Dependencies
From the `/mobile` directory in your terminal, run:
```bash
npm install
```

### Step 3: Launch the Metro Bundler
Start the development server:
```bash
npx expo start
```
A **QR Code** will render directly in your terminal.

### Step 4: Scan the Code
*   **iPhone**: Open your native camera app, scan the terminal QR code, and click the "Open in Expo Go" prompt.
*   **Android**: Open the **Expo Go** app, click "Scan QR Code", and scan the terminal code.

---

## 2. Connecting to Your FastAPI Backend

Mobile devices run on their own IP addresses. To speak to your computer's local FastAPI server:
1.  Ensure both your phone and your computer are connected to the **same Wi-Fi network**.
2.  Find your computer's local IP address (e.g. `192.168.1.100` on macOS via System Settings -> Wi-Fi -> Details).
3.  Enter this IP address into the **Backend IP** input box at the top of your mobile screen and tap **Connect**.

---

## 3. Creating Standalone Packages (.apk / .ipa)

When you are ready to distribute your app on the App Stores or install it natively, you can use **EAS Build** to package it in the cloud:

1.  Create a free Expo account: [https://expo.dev/](https://expo.dev/)
2.  Install the EAS CLI tool:
    ```bash
    npm install -g eas-cli
    ```
3.  Configure your project:
    ```bash
    eas build:configure
    ```
4.  Trigger a cloud build for Android (which yields an installable `.apk` file):
    ```bash
    eas build --platform android --profile preview
    ```
    Expo will compile the app on their servers and provide a download link when finished.
