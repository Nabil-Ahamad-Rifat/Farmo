import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Platform } from 'react-native';

// Required once per app for the auth session's browser popup/tab to close
// itself and hand control back to the app after Google redirects.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Check the client ID for the current platform so a configured iOS client
// cannot make an Android button render without an Android client ID (or vice
// versa).
export const isGoogleSignInConfigured = Boolean(
  Platform.select({
    ios: GOOGLE_IOS_CLIENT_ID,
    android: GOOGLE_ANDROID_CLIENT_ID,
    default: GOOGLE_WEB_CLIENT_ID,
  })
);

// Only ever call this from a component that already checked
// isGoogleSignInConfigured — expo-auth-session's AuthRequest requires a
// clientId and building one with all three undefined throws.
export function useGoogleAuthRequest() {
  return Google.useIdTokenAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  });
}
