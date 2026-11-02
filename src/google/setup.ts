// What Google Cloud needs before "Connect Google account" works: the steps the app shows when Google says sign-in isn't
// set up (ERR_NOT_CONFIGURED), the same as README.md › "Google account setup".

/** Google finds Halo's Android OAuth client by this package name and the release signing certificate's SHA-1. */
export const ANDROID_PACKAGE = "app.halo.health";
/** SHA-1 of signing/halo-release.p12, which signs every APK the Build APK workflow makes. */
export const RELEASE_SHA1 = "FF:C1:8B:55:5B:3B:AC:39:88:5D:AB:0B:03:3B:E7:41:65:FC:F0:29";

export const SETUP_STEPS: string[] = [
  "At console.cloud.google.com, create a project.",
  "APIs & Services › Library: search “Google Health API” and enable it.",
  "Google Auth Platform › Branding: app name Halo and your email. Audience: External, Testing, and add your Google account under Test users.",
  "Data access › Add or remove scopes: tick the Google Health API’s read scopes (googlehealth.….readonly) and …/auth/userinfo.email, then Save.",
  `Clients › Create client › Android: package name ${ANDROID_PACKAGE}, SHA-1 ${RELEASE_SHA1}.`,
  "Back in Halo, tap Connect and allow every box. Google can take a few minutes to recognise a new client.",
];

/** The steps as one text, for Share. */
export const setupText = () => ["Halo: set up Google sign-in (Google Health API)", ...SETUP_STEPS.map((s, i) => `${i + 1}. ${s}`)].join("\n");
