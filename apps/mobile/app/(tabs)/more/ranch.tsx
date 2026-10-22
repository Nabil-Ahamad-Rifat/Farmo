import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, Sprout, Check } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { useSession } from '@/src/context/AuthContext';
import { Button, Card, FormError, PageHeader, TextField } from '@/src/components/ui';
import { colors } from '@/src/theme';

// Mirrors apps/web/src/app/dashboard/ranches/page.tsx — creating a ranch
// here reassigns the signed-in account to a brand-new, empty tenant
// workspace. There is no "switch back": the previous tenant's data becomes
// inaccessible to this account, same as on web. Not in the menu (the web
// doesn't list it either), but kept reachable.
export default function NewRanchScreen() {
  const { createRanch } = useSession();
  const [ranchName, setRanchName] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!ranchName.trim()) {
      setError('Ranch name is required');
      return;
    }
    if (!understood) {
      setError('Please tick the box to confirm.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await createRanch(ranchName.trim());
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <PageHeader title="Create a New Ranch" subtitle="Start a fresh ranch workspace and switch your account to it." />
      <Card className="gap-4">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-card bg-brand-600">
            <Sprout size={20} color={colors.white} />
          </View>
          <Text className="flex-1 text-base font-bold text-ink">New ranch</Text>
        </View>
        <View className="flex-row gap-3 rounded-control border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle size={18} color={colors.amber600} />
          <Text className="flex-1 text-sm text-amber-800">
            This switches your account to a brand-new, empty workspace. You will lose access to your current ranch&apos;s cows, employees, sales, and every
            other record. There is no way to switch back.
          </Text>
        </View>
        <FormError message={error} />
        <TextField label="Ranch Name" placeholder="e.g. Sunrise Meadow Ranch" value={ranchName} onChangeText={setRanchName} />
        <Pressable
          onPress={() => setUnderstood(!understood)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: understood }}
          className="flex-row items-start gap-3"
        >
          <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${understood ? 'border-ink bg-ink' : 'border-slate-300 bg-white'}`}>
            {understood ? <Check size={14} color={colors.white} /> : null}
          </View>
          <Text className="flex-1 text-sm text-slate-700">I understand my current ranch&apos;s data will no longer be accessible from this account.</Text>
        </Pressable>
        <Button label="Create Ranch" size="lg" loading={loading} disabled={!understood} onPress={handleCreate} />
      </Card>
    </ScrollView>
  );
}
