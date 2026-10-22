import { Stack } from 'expo-router';
import { AppHeader } from '@/src/components/shell/AppHeader';
import { colors } from '@/src/theme';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ header: () => <AppHeader back />, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="index" options={{ header: () => <AppHeader /> }} />
    </Stack>
  );
}
