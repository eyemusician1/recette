@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ---------------------------------------------------------------------------
REM Remy's dependency bootstrap script
REM Creates a new React Native app pinned to the same dependency versions
REM used in this repository, then creates a clean app foundation scaffold.
REM
REM Usage:
REM   setup.bat MyNewApp
REM   setup.bat MyNewApp D:\projects
REM   setup.bat MyNewApp --with-navigation-template
REM   setup.bat MyNewApp --require-android
REM   setup.bat MyNewApp D:\projects --with-navigation-template --require-android
REM   (flags are order-independent and may appear anywhere after AppName)
REM ---------------------------------------------------------------------------

REM ---------------------------------------------------------------------------
REM Argument parsing — loop-based so flags are order-independent
REM ---------------------------------------------------------------------------
set "APP_NAME="
set "TARGET_DIR="
set "WITH_NAV_TEMPLATE=0"
set "REQUIRE_ANDROID=0"

:parse_args
if "%~1"=="" goto end_parse
set "_ARG=%~1"

if /I "!_ARG!"=="--with-navigation-template" (
  set "WITH_NAV_TEMPLATE=1"
  shift & goto parse_args
)
if /I "!_ARG!"=="--require-android" (
  set "REQUIRE_ANDROID=1"
  shift & goto parse_args
)
REM Reject unrecognised flags
if "!_ARG:~0,2!"=="--" (
  echo ERROR: Unknown flag "!_ARG!". Valid flags: --with-navigation-template, --require-android
  exit /b 1
)
REM Positional: first non-flag = AppName, second = TargetDirectory
if "!APP_NAME!"=="" (
  set "APP_NAME=!_ARG!"
  shift & goto parse_args
)
if "!TARGET_DIR!"=="" (
  set "TARGET_DIR=!_ARG!"
  shift & goto parse_args
)
echo WARNING: Extra positional argument "!_ARG!" ignored.
shift & goto parse_args
:end_parse

if "!APP_NAME!"=="" (
  echo Usage: %~nx0 ^<AppName^> [TargetDirectory] [--with-navigation-template] [--require-android]
  echo.
  echo   AppName must be PascalCase, letters and digits only ^(e.g. MyNewApp^)
  echo   Flags are order-independent and may appear anywhere after AppName.
  exit /b 1
)

if "!TARGET_DIR!"=="" set "TARGET_DIR=%cd%"
set "APP_DIR=!TARGET_DIR!\!APP_NAME!"

REM ---------------------------------------------------------------------------
echo.
echo [1/9] Checking required tools...

REM --- Validate AppName: letters and digits only ---
echo !APP_NAME!| findstr /R "[^A-Za-z0-9]" >nul 2>nul
if not errorlevel 1 (
  echo ERROR: AppName "!APP_NAME!" is invalid. Use only letters and digits ^(PascalCase^).
  exit /b 1
)

REM --- Validate AppName: must start with an uppercase letter ---
set "_FC=!APP_NAME:~0,1!"
set "_VALID_FIRST=0"
for %%C in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
  if "%%C"=="!_FC!" set "_VALID_FIRST=1"
)
if "!_VALID_FIRST!"=="0" (
  echo ERROR: AppName "!APP_NAME!" must start with an uppercase letter ^(PascalCase^).
  exit /b 1
)

REM --- node ---
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  exit /b 1
)

REM --- npm ---
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found in PATH.
  exit /b 1
)

REM --- git ---
where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git was not found in PATH. Install Git from https://git-scm.com
  exit /b 1
)

REM --- powershell ---
where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: PowerShell was not found in PATH ^(required for step 5^).
  exit /b 1
)

REM --- java (only required when --require-android is set) ---
REM IMPORTANT: Capture errorlevel into a variable IMMEDIATELY after "where java"
REM before any if/for statement can overwrite it. Testing errorlevel inside a
REM nested if block reads the result of the outer if comparison, not of "where".
where java >nul 2>nul
set "JAVA_FOUND=1"
if errorlevel 1 set "JAVA_FOUND=0"

if "!REQUIRE_ANDROID!"=="1" (
  if "!JAVA_FOUND!"=="0" (
    echo ERROR: Java was not found in PATH. Install JDK 17 or later ^(required for Android builds^).
    exit /b 1
  )
)

REM --- ANDROID_HOME (only required when --require-android is set) ---
if "!REQUIRE_ANDROID!"=="1" (
  if "!ANDROID_HOME!"=="" (
    echo ERROR: ANDROID_HOME is not set. Install Android Studio and configure this variable.
    exit /b 1
  )
  if not exist "!ANDROID_HOME!" (
    echo ERROR: ANDROID_HOME points to a missing directory: "!ANDROID_HOME!"
    exit /b 1
  )
)

REM --- Target directory / app folder collision check ---
if exist "!APP_DIR!" (
  echo ERROR: Folder already exists: "!APP_DIR!"
  exit /b 1
)

if not exist "!TARGET_DIR!" (
  mkdir "!TARGET_DIR!"
  if errorlevel 1 (
    echo ERROR: Failed to create target directory: "!TARGET_DIR!"
    exit /b 1
  )
)

REM ---------------------------------------------------------------------------
echo.
echo [2/9] Creating React Native app !APP_NAME! (RN 0.76.9)...
pushd "!TARGET_DIR!"
call npx @react-native-community/cli@15.0.1 init "!APP_NAME!" --version 0.76.9 --skip-install
set "INIT_EXIT=!ERRORLEVEL!"
popd
if not "!INIT_EXIT!"=="0" (
  echo ERROR: Failed to create React Native app.
  exit /b 1
)

cd /d "!APP_DIR!"

REM ---------------------------------------------------------------------------
echo.
echo [3/9] Installing runtime dependencies (exact versions)...
call npm install --save-exact --no-progress --no-audit --no-fund ^
  @react-navigation/bottom-tabs@7.15.5 ^
  @react-navigation/native@7.1.33 ^
  @react-navigation/native-stack@7.14.5 ^
  react@18.3.1 ^
  react-native@0.76.9 ^
  react-native-safe-area-context@4.12.0 ^
  react-native-screens@4.4.0 ^
  react-native-vector-icons@10.3.0
if errorlevel 1 (
  echo ERROR: Runtime dependency install failed.
  exit /b 1
)

REM ---------------------------------------------------------------------------
echo.
echo [4/9] Installing dev dependencies (exact versions)...
call npm install -D --save-exact --no-progress --no-audit --no-fund ^
  @babel/core@7.25.2 ^
  @babel/preset-env@7.25.3 ^
  @babel/runtime@7.25.0 ^
  @react-native-community/cli@15.0.1 ^
  @react-native-community/cli-platform-android@15.0.1 ^
  @react-native-community/cli-platform-ios@15.0.1 ^
  @react-native/babel-preset@0.76.9 ^
  @react-native/eslint-config@0.76.9 ^
  @react-native/metro-config@0.76.9 ^
  @react-native/typescript-config@0.76.9 ^
  @types/react@18.2.6 ^
  @types/react-test-renderer@18.0.0 ^
  babel-jest@29.6.3 ^
  eslint@8.19.0 ^
  jest@29.6.3 ^
  prettier@2.8.8 ^
  react-test-renderer@18.3.1 ^
  typescript@5.0.4
if errorlevel 1 (
  echo ERROR: Dev dependency install failed.
  exit /b 1
)

REM NOTE: @types/react-native-vector-icons was removed. react-native-vector-icons@10+
REM ships its own TypeScript declarations — the DefinitelyTyped package (last maintained
REM at v6-v7) conflicts with them and is no longer needed.

REM ---------------------------------------------------------------------------
REM Step 5 — Android toolchain pin. Only runs when --require-android is set.
REM react-native init always generates these files, so skipping the patch is
REM safe for JS-only or iOS-only workflows. Run again with --require-android
REM before your first Android build.
REM ---------------------------------------------------------------------------
if "!REQUIRE_ANDROID!"=="1" (
  echo.
  echo [5/9] Pinning Android build toolchain versions...
  set "PIN_PS1=%TEMP%\pin_remys_android_!RANDOM!!RANDOM!.ps1"
  (
    echo $ErrorActionPreference = 'Stop'
    echo $root = Get-Location
    echo.
    echo $buildGradle  = Join-Path $root 'android/build.gradle'
    echo $wrapperProps = Join-Path $root 'android/gradle/wrapper/gradle-wrapper.properties'
    echo $gradleProps  = Join-Path $root 'android/gradle.properties'
    echo.
    echo # --- android/build.gradle ---
    echo $c = Get-Content -Raw $buildGradle
    echo $c = [regex]::Replace($c, 'buildToolsVersion\s*=\s*"[^"]+"', 'buildToolsVersion = "35.0.0"'^)
    echo $c = [regex]::Replace($c, 'minSdkVersion\s*=\s*\d+',         'minSdkVersion = 24'^)
    echo $c = [regex]::Replace($c, 'compileSdkVersion\s*=\s*\d+',     'compileSdkVersion = 35'^)
    echo $c = [regex]::Replace($c, 'targetSdkVersion\s*=\s*\d+',      'targetSdkVersion = 34'^)
    echo $c = [regex]::Replace($c, 'ndkVersion\s*=\s*"[^"]+"',        'ndkVersion = "26.1.10909125"'^)
    echo $c = [regex]::Replace($c, 'kotlinVersion\s*=\s*"[^"]+"',     'kotlinVersion = "1.9.25"'^)
    echo Set-Content -Path $buildGradle -Value $c -NoNewline
    echo.
    echo # --- gradle-wrapper.properties ---
    echo # Single backslash before the colon is intentional.
    echo # gradle.properties format requires the colon to be escaped as \:
    echo $w = Get-Content -Raw $wrapperProps
    echo $w = [regex]::Replace($w, 'distributionUrl=.*', 'distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-all.zip'^)
    echo Set-Content -Path $wrapperProps -Value $w -NoNewline
    echo.
    echo # --- gradle.properties ---
    echo $g = Get-Content -Raw $gradleProps
    echo $g = [regex]::Replace($g, 'org\.gradle\.jvmargs=.*',     'org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m'^)
    echo $g = [regex]::Replace($g, 'reactNativeArchitectures=.*', 'reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64'^)
    echo $g = [regex]::Replace($g, 'newArchEnabled=.*',           'newArchEnabled=true'^)
    echo $g = [regex]::Replace($g, 'hermesEnabled=.*',            'hermesEnabled=true'^)
    echo if ($g -notmatch 'reactNativeArchitectures='^) { $g = $g.TrimEnd(^) + "`r`nreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`r`n" }
    echo if ($g -notmatch 'newArchEnabled='^)           { $g = $g.TrimEnd(^) + "`r`nnewArchEnabled=true`r`n" }
    echo if ($g -notmatch 'hermesEnabled='^)            { $g = $g.TrimEnd(^) + "`r`nhermesEnabled=true`r`n" }
    echo Set-Content -Path $gradleProps -Value $g -NoNewline
  ) > "!PIN_PS1!"

  call powershell -NoProfile -ExecutionPolicy Bypass -File "!PIN_PS1!"
  set "PIN_EXIT=!ERRORLEVEL!"
  del "!PIN_PS1!" >nul 2>nul
  if not "!PIN_EXIT!"=="0" (
    echo ERROR: Failed to pin Android build versions.
    exit /b 1
  )
) else (
  echo.
  echo [5/9] Skipping Android toolchain pin ^(pass --require-android to enable^).
)

REM ---------------------------------------------------------------------------
echo.
echo [6/9] Applying baseline config files...
if not exist "assets\fonts" mkdir "assets\fonts"
if not exist "src" mkdir "src"

>react-native.config.js (
  echo module.exports = {
  echo   assets: ['./assets/fonts/'],
  echo };
)

>babel.config.js (
  echo module.exports = {
  echo   presets: ['module:@react-native/babel-preset'],
  echo };
)

>metro.config.js (
  echo const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config'^);
  echo.
  echo /**
  echo  * Metro configuration
  echo  * https://reactnative.dev/docs/metro
  echo  *
  echo  * @type {import('metro-config'^).MetroConfig}
  echo  */
  echo const config = {};
  echo.
  echo module.exports = mergeConfig(getDefaultConfig(__dirname^), config^);
)

>jest.config.js (
  echo module.exports = {
  echo   preset: 'react-native',
  echo };
)

>tsconfig.json (
  echo {
  echo   "extends": "@react-native/typescript-config/tsconfig.json"
  echo }
)

>.eslintrc.js (
  echo module.exports = {
  echo   root: true,
  echo   extends: '@react-native',
  echo };
)

>.prettierrc (
  echo {
  echo   "arrowParens": "avoid",
  echo   "bracketSameLine": true,
  echo   "bracketSpacing": false,
  echo   "singleQuote": true,
  echo   "trailingComma": "all"
  echo }
)

REM ---------------------------------------------------------------------------
echo.
echo [7/9] Creating foundation src structure...
if not exist "src\components" mkdir "src\components"
if not exist "src\hooks"      mkdir "src\hooks"
if not exist "src\navigation" mkdir "src\navigation"
if not exist "src\screens"    mkdir "src\screens"
if not exist "src\services"   mkdir "src\services"
if not exist "src\tokens"     mkdir "src\tokens"
if not exist "src\utils"      mkdir "src\utils"
if not exist "assets\images"  mkdir "assets\images"

>src\tokens\colors.ts (
  echo export const palette = {
  echo   bg:         '#faf6ef',
  echo   surface:    '#f3ede3',
  echo   ink:        '#2c1a0e',
  echo   body:       '#5a3e2b',
  echo   muted:      '#a08878',
  echo   terracotta: '#c8522a',
  echo   border:     'rgba(44,26,14,0.1^)',
  echo   white:      '#ffffff',
  echo } as const;
)

>src\tokens\spacing.ts (
  echo export const spacing = {
  echo   xs:   4,
  echo   sm:   8,
  echo   md:   12,
  echo   lg:   16,
  echo   xl:   24,
  echo   xxl:  32,
  echo   xxxl: 48,
  echo } as const;
)

REM NOTE: 'System' is not a valid fontFamily value on Android. Omitting body
REM intentionally falls back to the platform default sans-serif via RN's
REM default StyleSheet behaviour. Use the serif token only for deliberate
REM typographic accents — bundle Georgia.ttf in assets/fonts/ if targeting
REM Android, as Georgia is not guaranteed present on all Android devices.
>src\tokens\typography.ts (
  echo export const typography = {
  echo   /**
  echo    * Serif accent font. On Android, bundle Georgia.ttf in assets/fonts/
  echo    * and run: npx react-native-asset
  echo    * On iOS, Georgia is available as a system font.
  echo    */
  echo   serif: 'Georgia',
  echo } as const;
)

>src\tokens\index.ts (
  echo export * from './colors';
  echo export * from './spacing';
  echo export * from './typography';
)

if "!WITH_NAV_TEMPLATE!"=="1" (

  >src\screens\HomeScreen.tsx (
    echo import React from 'react';
    echo import {StyleSheet, Text, View} from 'react-native';
    echo import {palette, spacing, typography} from '../tokens';
    echo.
    echo export function HomeScreen^(^) {
    echo   return ^(
    echo     ^<View style={styles.container}^>
    echo       ^<Text style={styles.title}^>Home^</Text^>
    echo       ^<Text style={styles.sub}^>Start building your first screen.^</Text^>
    echo     ^</View^>
    echo   ^);
    echo }
    echo.
    echo const styles = StyleSheet.create^({
    echo   container: {
    echo     flex: 1,
    echo     backgroundColor: palette.bg,
    echo     alignItems: 'center',
    echo     justifyContent: 'center',
    echo     padding: spacing.xl,
    echo   },
    echo   title: {
    echo     color: palette.ink,
    echo     fontSize: 30,
    echo     marginBottom: spacing.sm,
    echo     fontFamily: typography.serif,
    echo   },
    echo   sub: {
    echo     color: palette.body,
    echo     fontSize: 18,
    echo   },
    echo }^);
  )

  >src\screens\ExploreScreen.tsx (
    echo import React from 'react';
    echo import {StyleSheet, Text, View} from 'react-native';
    echo import {palette, spacing, typography} from '../tokens';
    echo.
    echo export function ExploreScreen^(^) {
    echo   return ^(
    echo     ^<View style={styles.container}^>
    echo       ^<Text style={styles.title}^>Explore^</Text^>
    echo     ^</View^>
    echo   ^);
    echo }
    echo.
    echo const styles = StyleSheet.create^({
    echo   container: {
    echo     flex: 1,
    echo     backgroundColor: palette.bg,
    echo     alignItems: 'center',
    echo     justifyContent: 'center',
    echo     padding: spacing.xl,
    echo   },
    echo   title: {
    echo     color: palette.ink,
    echo     fontSize: 30,
    echo     fontFamily: typography.serif,
    echo   },
    echo }^);
  )

  >src\screens\ProfileScreen.tsx (
    echo import React from 'react';
    echo import {StyleSheet, Text, View} from 'react-native';
    echo import {palette, spacing, typography} from '../tokens';
    echo.
    echo export function ProfileScreen^(^) {
    echo   return ^(
    echo     ^<View style={styles.container}^>
    echo       ^<Text style={styles.title}^>Profile^</Text^>
    echo     ^</View^>
    echo   ^);
    echo }
    echo.
    echo const styles = StyleSheet.create^({
    echo   container: {
    echo     flex: 1,
    echo     backgroundColor: palette.bg,
    echo     alignItems: 'center',
    echo     justifyContent: 'center',
    echo     padding: spacing.xl,
    echo   },
    echo   title: {
    echo     color: palette.ink,
    echo     fontSize: 30,
    echo     fontFamily: typography.serif,
    echo   },
    echo }^);
  )

  REM NOTE: tabBarIcon is intentionally omitted — this is a minimal scaffold.
  REM Add icons per tab using react-native-vector-icons in AppNavigator.tsx,
  REM e.g.: tabBarIcon: ({color, size}) => <Icon name="home" color={color} size={size} />
  >src\navigation\AppNavigator.tsx (
    echo import React from 'react';
    echo import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
    echo import {HomeScreen}    from '../screens/HomeScreen';
    echo import {ExploreScreen} from '../screens/ExploreScreen';
    echo import {ProfileScreen} from '../screens/ProfileScreen';
    echo.
    echo const Tab = createBottomTabNavigator^(^);
    echo.
    echo export function AppNavigator^(^) {
    echo   return ^(
    echo     ^<Tab.Navigator screenOptions={{headerShown: false}}^>
    echo       ^<Tab.Screen name="Home"    component={HomeScreen} /^>
    echo       ^<Tab.Screen name="Explore" component={ExploreScreen} /^>
    echo       ^<Tab.Screen name="Profile" component={ProfileScreen} /^>
    echo     ^</Tab.Navigator^>
    echo   ^);
    echo }
  )

  >App.tsx (
    echo import React from 'react';
    echo import {StatusBar} from 'react-native';
    echo import {NavigationContainer} from '@react-navigation/native';
    echo import {SafeAreaProvider} from 'react-native-safe-area-context';
    echo import {AppNavigator} from './src/navigation/AppNavigator';
    echo import {palette} from './src/tokens';
    echo.
    echo function App^(^): React.JSX.Element {
    echo   return ^(
    echo     ^<SafeAreaProvider^>
    echo       ^<StatusBar barStyle="dark-content" backgroundColor={palette.bg} /^>
    echo       ^<NavigationContainer^>
    echo         ^<AppNavigator /^>
    echo       ^</NavigationContainer^>
    echo     ^</SafeAreaProvider^>
    echo   ^);
    echo }
    echo.
    echo export default App;
  )

) else (

  >src\screens\HomeScreen.tsx (
    echo import React from 'react';
    echo import {StyleSheet, Text, View} from 'react-native';
    echo import {palette, spacing, typography} from '../tokens';
    echo.
    echo export function HomeScreen^(^) {
    echo   return ^(
    echo     ^<View style={styles.container}^>
    echo       ^<Text style={styles.title}^>App Foundation Ready^</Text^>
    echo       ^<Text style={styles.sub}^>Start redesigning from this base.^</Text^>
    echo     ^</View^>
    echo   ^);
    echo }
    echo.
    echo const styles = StyleSheet.create^({
    echo   container: {
    echo     flex: 1,
    echo     backgroundColor: palette.bg,
    echo     alignItems: 'center',
    echo     justifyContent: 'center',
    echo     padding: spacing.xl,
    echo   },
    echo   title: {
    echo     color: palette.ink,
    echo     fontSize: 30,
    echo     marginBottom: spacing.sm,
    echo     fontFamily: typography.serif,
    echo   },
    echo   sub: {
    echo     color: palette.body,
    echo     fontSize: 18,
    echo   },
    echo }^);
  )

  >App.tsx (
    echo import React from 'react';
    echo import {StatusBar} from 'react-native';
    echo import {SafeAreaProvider} from 'react-native-safe-area-context';
    echo import {HomeScreen} from './src/screens/HomeScreen';
    echo import {palette} from './src/tokens';
    echo.
    echo function App^(^): React.JSX.Element {
    echo   return ^(
    echo     ^<SafeAreaProvider^>
    echo       ^<StatusBar barStyle="dark-content" backgroundColor={palette.bg} /^>
    echo       ^<HomeScreen /^>
    echo     ^</SafeAreaProvider^>
    echo   ^);
    echo }
    echo.
    echo export default App;
  )

)

REM ---------------------------------------------------------------------------
echo.
echo [8/9] Ensuring scripts and engine in package.json...
call npm pkg set scripts.android="react-native run-android" >nul
call npm pkg set scripts.ios="react-native run-ios"         >nul
call npm pkg set scripts.lint="eslint ."                    >nul
call npm pkg set scripts.start="react-native start"         >nul
call npm pkg set scripts.test="jest"                        >nul
call npm pkg set engines.node=">=18"                        >nul

REM ---------------------------------------------------------------------------
echo.
echo [9/9] Done.
echo.
echo App created at:
echo   !APP_DIR!
echo.
echo Next steps:
echo   1. cd /d "!APP_DIR!"
echo   2. Start Metro:      npm start
echo   3. Build Android:    npm run android
if "!WITH_NAV_TEMPLATE!"=="1" (
  echo   4. Navigation starter is in src\navigation\AppNavigator.tsx
  echo      Add tabBarIcon props to each Tab.Screen to show icons in the tab bar.
) else (
  echo   4. Re-run with --with-navigation-template for a 3-tab starter scaffold
)
echo   5. Start redesigning files in src\screens and src\components
echo   6. Install your preferred database/auth packages per app
echo.
echo Vector icons setup ^(required before using react-native-vector-icons^):
echo   a. Copy desired .ttf files from node_modules\react-native-vector-icons\Fonts\
echo      into assets\fonts\
echo   b. Run: npx react-native-asset
echo   c. Rebuild:  npm run android
echo.
if "!REQUIRE_ANDROID!"=="1" (
  echo Pinned Android versions:
  echo   buildToolsVersion : 35.0.0
  echo   compileSdkVersion : 35
  echo   targetSdkVersion  : 34
  echo   minSdkVersion     : 24
  echo   ndkVersion        : 26.1.10909125
  echo   kotlinVersion     : 1.9.25
  echo   Gradle            : 8.10.2-all
  echo.
) else (
  echo Android toolchain was NOT pinned.
  echo   Re-run with --require-android to validate your environment and pin
  echo   Gradle, NDK, Kotlin, and SDK versions before your first Android build.
  echo.
)
echo Notes:
echo   - All 4 ABI architectures are enabled ^(armeabi-v7a, arm64-v8a, x86, x86_64^).
echo     For faster debug builds, edit android\gradle.properties and set:
echo     reactNativeArchitectures=arm64-v8a
echo   - If you add packages that require Kotlin 2.x, bump kotlinVersion in
echo     android\build.gradle accordingly ^(tested up to 2.1.0^).
echo.
echo Optional release APK:
echo   cd android ^&^& .\gradlew assembleRelease
endlocal
exit /b 0