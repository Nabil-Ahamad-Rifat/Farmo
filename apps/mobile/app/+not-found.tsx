import { Link, Stack } from 'expo-router';
import { View, Pressable } from 'react-native';
import { SearchX } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-surface p-6">
        <View className="h-12 w-12 items-center justify-center rounded-card bg-slate-100">
          <SearchX size={22} color={colors.slate400} />
        </View>
        <Text className="text-xl font-bold text-ink">Page not found</Text>
        <Text className="text-center text-sm text-slate-500">This page doesn&apos;t exist or was moved.</Text>
        <Link href="/" asChild>
          <Pressable className="mt-2 h-11 items-center justify-center rounded-control bg-ink px-5" accessibilityRole="link">
            <Text className="text-sm font-semibold text-white">Back to overview</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
