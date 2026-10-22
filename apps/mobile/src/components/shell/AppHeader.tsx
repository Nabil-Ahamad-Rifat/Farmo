import { useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, CloudOff, RefreshCw } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { useOfflineBanner } from '@/src/lib/sync';
import { onQueued } from '@/src/lib/syncStore';
import { useToast } from '@/src/components/ui/Feedback';
import { useSession } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';
import { FarmBadge } from './Brand';

/**
 * The navy top bar on every signed-in screen, like the web's phone top bar:
 * the farm badge, plus a back arrow on screens opened from another screen.
 * Page titles live in the page itself (PageHeader), as on the web.
 */
export function AppHeader({ back }: { back?: boolean }) {
  const insets = useSafeAreaInsets();
  const { farmName } = useSession();
  return (
    <View className="bg-navy-900" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-2 px-4">
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="-ml-2 h-11 w-11 items-center justify-center rounded-control"
          >
            <ArrowLeft size={20} color={colors.white} />
          </Pressable>
        ) : null}
        <FarmBadge name={farmName} />
      </View>
      <OfflineBanner />
    </View>
  );
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Several headers can be mounted at once (tabs, stacks); only one toast per save.
let lastQueuedToast = 0;

/** Amber strip under the bar while offline or while saved entries upload. */
function OfflineBanner() {
  const { online, staleSince, syncing, pending } = useOfflineBanner();
  const toast = useToast();

  // A form saved while offline: replace its "saved" toast with what really happened.
  useEffect(
    () =>
      onQueued(() => {
        const now = Date.now();
        if (now - lastQueuedToast < 1000) return;
        lastQueuedToast = now;
        setTimeout(() => toast('Saved offline — will upload when online', 'info'), 600);
      }),
    [toast]
  );

  if (online && !(syncing && pending > 0) && staleSince === null) return null;
  if (online && syncing && pending > 0) {
    return (
      <View className="flex-row items-center gap-2 bg-sky-100 px-4 py-1.5" accessibilityRole="alert">
        <RefreshCw size={13} color={colors.sky700} />
        <Text className="text-xs font-semibold text-sky-800">Uploading {pending}…</Text>
      </View>
    );
  }
  const parts = ['Offline'];
  if (staleSince !== null) parts.push(`showing data from ${hhmm(staleSince)}`);
  if (pending > 0) parts.push(`${pending} waiting to upload`);
  return (
    <View className="flex-row items-center gap-2 bg-amber-100 px-4 py-1.5" accessibilityRole="alert">
      <CloudOff size={13} color={colors.amber700} />
      <Text className="flex-1 text-xs font-semibold text-amber-900">{parts.join(' · ')}</Text>
    </View>
  );
}
