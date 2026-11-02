/**
 * Whether Settings and onboarding offer the Google account (Google Health API) as a data source. It was kept off while
 * the source was being built (a build could ship from a half-done tree); switching it off again hides the choice, and
 * the sync, background task and live pull keep working for anyone whose saved source is already "google".
 */
// Off: Health Connect stays the source. The sign-in module is built in for the SpO2 supplement (google/spo2.ts).
export const GOOGLE_SOURCE_ENABLED = false;
