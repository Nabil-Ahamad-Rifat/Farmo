import '@/src/lib/cryptoPolyfill';
import '../global.css';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useSession } from '@/src/context/AuthContext';
import { SplashScreenController } from '@/src/components/SplashScreenController';
import { UpdateRequiredScreen } from '@/src/components/UpdateRequiredScreen';
import { fetchVersionInfo, isVersionBelow } from '@/src/lib/version';
import { FeedbackProvider } from '@/src/components/ui/Feedback';
import { AppHeader } from '@/src/components/shell/AppHeader';
import { colors } from '@/src/theme';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  // Same font as the web app; the splash stays up until it has loaded.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <SplashScreenController ready={fontsReady} />
      {fontsReady ? (
        <FeedbackProvider>
          <AppGate />
        </FeedbackProvider>
      ) : null}
    </AuthProvider>
  );
}

function AppGate() {
  const [versionState, setVersionState] = useState<'checking' | 'ok' | 'blocked'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetchVersionInfo().then((info) => {
      if (cancelled) return;
      const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
      setVersionState(info && isVersionBelow(currentVersion, info.forceUpdateBelow) ? 'blocked' : 'ok');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (versionState === 'checking') return null;
  if (versionState === 'blocked') return <UpdateRequiredScreen />;

  return <RootNavigator />;
}

// Detail pages opened from several tabs, so their back arrow returns to where you were.
const DETAIL_SCREENS = ['animal/[id]', 'worker/[id]', 'customer/[id]', 'supplier/[id]'];

function RootNavigator() {
  const { user } = useSession();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        {DETAIL_SCREENS.map((name) => (
          <Stack.Screen key={name} name={name} options={{ headerShown: true, header: () => <AppHeader back /> }} />
        ))}
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
