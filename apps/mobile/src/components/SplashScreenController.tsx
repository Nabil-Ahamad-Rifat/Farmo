import * as SplashScreen from 'expo-splash-screen';
import { useSession } from '@/src/context/AuthContext';

SplashScreen.preventAutoHideAsync();

// Keeps the native splash screen up while we check SecureStore for an
// existing session, so the login screen never flashes before redirecting an
// already-authenticated user into the app.
// Also waits for the app font (ready) so text never jumps from the system font.
export function SplashScreenController({ ready = true }: { ready?: boolean }) {
  const { isLoading } = useSession();

  if (!isLoading && ready) {
    SplashScreen.hide();
  }

  return null;
}
