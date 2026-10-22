import { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Linking, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Milk, UserCog, ChevronRight } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { API_URL, mobileApiClient } from '@/src/lib/apiClient';
import { Button, Card, FormError, PageHeader, TextField, useToast } from '@/src/components/ui';
import { DeleteAccountCard } from '@/src/components/DeleteAccountCard';
import { DataSyncCard } from '@/src/components/settings/DataSyncCard';
import { cardShadow, colors } from '@/src/theme';
import { useOwnerOnly } from '@/src/hooks/useOwnerOnly';

/** Owner settings, like the web's /dashboard/settings: sales defaults, team link, data & sync, delete account. */
export default function SettingsScreen() {
  const allowed = useOwnerOnly();
  return allowed ? <SettingsScreenContent /> : null;
}

function SettingsScreenContent() {
  const toast = useToast();
  const [saved, setSaved] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mobileApiClient
      .get<{ defaultMilkPrice: number }>('/api/settings', 'Failed to load settings')
      .then((s) => {
        setSaved(String(s.defaultMilkPrice));
        setPrice(String(s.defaultMilkPrice));
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  async function save() {
    setError('');
    setSaving(true);
    try {
      const s = await mobileApiClient.put<{ defaultMilkPrice: number }>('/api/settings', { defaultMilkPrice: price }, 'Failed to save');
      setSaved(String(s.defaultMilkPrice));
      setPrice(String(s.defaultMilkPrice));
      toast('Default milk price saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <PageHeader title="Settings" subtitle="Farm preferences and your account." />

      <Card className="gap-4">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-card bg-brand-50">
            <Milk size={20} color={colors.brand600} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink">Sales defaults</Text>
            <Text className="text-sm text-slate-500">The sale form fills in each customer&apos;s last milk price. New customers start with this price.</Text>
          </View>
        </View>
        {saved === null && !error ? (
          <ActivityIndicator />
        ) : (
          <>
            <FormError message={error} />
            <TextField label="Default milk price (৳ per L)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
            <Button label="Save" size="lg" loading={saving} disabled={price === saved} onPress={save} />
          </>
        )}
      </Card>

      <Pressable onPress={() => router.push('/more/team')} style={cardShadow} className="flex-row items-center gap-3 rounded-card border border-line bg-white p-4" accessibilityRole="link">
        <View className="h-11 w-11 items-center justify-center rounded-card bg-sky-50">
          <UserCog size={20} color={colors.sky700} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink">Team</Text>
          <Text className="text-sm text-slate-500">Logins for managers who do the daily work.</Text>
        </View>
        <ChevronRight size={18} color={colors.slate400} />
      </Pressable>

      <DataSyncCard />

      <DeleteAccountCard />

      <Text className="text-center text-sm text-slate-500">
        Read our{' '}
        <Text className="font-semibold text-brand-700" onPress={() => Linking.openURL(`${API_URL}/privacy`)}>
          Privacy Policy
        </Text>
      </Text>
    </ScrollView>
  );
}
