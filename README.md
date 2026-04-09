This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

>**Note**: Make sure you have completed the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) instructions till "Creating a new application" step, before proceeding.

## Step 1: Start the Metro Server

First, you will need to start **Metro**, the JavaScript _bundler_ that ships _with_ React Native.

To start Metro, run the following command from the _root_ of your React Native project:

```bash
# using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Start your Application

Let Metro Bundler run in its _own_ terminal. Open a _new_ terminal from the _root_ of your React Native project. Run the following command to start your _Android_ or _iOS_ app:

### For Android

```bash
# using npm
npm run android

# OR using Yarn
yarn android
```

### For iOS

```bash
# using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up _correctly_, you should see your new app running in your _Android Emulator_ or _iOS Simulator_ shortly provided you have set up your emulator/simulator correctly.

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

## Step 3: Modifying your App

Now that you have successfully run the app, let's modify it.

1. Open `App.tsx` in your text editor of choice and edit some lines.
2. For **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Developer Menu** (<kbd>Ctrl</kbd> + <kbd>M</kbd> (on Window and Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (on macOS)) to see your changes!

   For **iOS**: Hit <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in your iOS Simulator to reload the app and see your changes!

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [Introduction to React Native](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you can't get this to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

## Build iOS From Windows (GitHub Actions)

You can build a signed iOS IPA without a local Mac by using the GitHub Actions workflow in `.github/workflows/ios-release.yml`.

1. Install GitHub CLI on Windows and log in.
2. Run the helper script from project root to generate and set secrets:

```powershell
pwsh .\scripts\prepare-ios-gh-secrets.ps1 \
   -P12Path C:\path\to\cert.p12 \
   -P12Password "YOUR_P12_PASSWORD" \
   -ProvisioningProfilePath C:\path\to\profile.mobileprovision \
   -TeamId "YOUR_TEAM_ID" \
   -BundleIdentifier "com.recette" \
   -KeychainPassword "YOUR_TEMP_KEYCHAIN_PASSWORD" \
   -SetGithubSecrets
```

3. Commit and push to GitHub.
4. Trigger build with:

```powershell
pwsh .\scripts\trigger-ios-release.ps1 -Ref main
```

5. Open Actions in GitHub and download the `remys-ios-ipa` artifact from the latest run.

If you do not want automatic secret upload, run the helper without `-SetGithubSecrets` and copy the generated files from `.ios-secrets-output` into GitHub repository secrets manually.

Notes:
- You still need an Apple Developer account for signing and TestFlight/App Store distribution.
- If this is your first iOS release, create certificate/profile in App Store Connect + Apple Developer first.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
"# recette" 
