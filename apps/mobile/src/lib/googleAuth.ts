import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// Required once per app for the auth session's browser popup/tab to close
// itself and hand control back to the app after Google redirects.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Mirrors the web app's "Continue with Google is disabled if these are
// blank" behavior (apps/web/.env.example) — the button simply doesn't
// render when no client ID is configured, rather than crashing.
export const isGoogleSignInConfigured = Boolean(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);

// Only ever call this from a component that already checked
// isGoogleSignInConfigured — expo-auth-session's AuthRequest requires a
// clientId and building one with all three undefined throws.
export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
}
