import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ShieldAlert, AlertTriangle, Check } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { useSession } from '@/src/context/AuthContext';
import { Button, Card, FormError, TextField } from '@/src/components/ui';
import { colors } from '@/src/theme';

// Apple App Store Guideline 5.1.1(v) / Google Play's User Data policy: an app
// with in-app account creation must let the user delete that account from
// inside the app — see apps/web/src/app/api/auth/account/delete/route.ts.
// Same card as the web Settings page. For a manager the server removes only
// their own login, so the wording says so.
export function DeleteAccountCard() {
  const { deleteAccount, isOwner } = useSession();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setError('');
    if (!understood) {
      setError('Please tick the box to confirm.');
      return;
    }
    setLoading(true);
    try {
      await deleteAccount(password || undefined);
      router.replace('/(auth)/login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const title = isOwner ? 'Delete My Account' : 'Delete my login';
  return (
    <Card className="gap-4 border-red-200">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-card bg-red-600">
          <ShieldAlert size={20} color={colors.white} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">{title}</Text>
          <Text className="text-sm text-slate-500">
            {isOwner ? "Permanently delete your account and all of your farm's data." : 'Remove your own login from this farm.'}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3 rounded-control border border-red-200 bg-red-50 p-3.5">
        <AlertTriangle size={18} color={colors.red600} />
        <Text className="flex-1 text-sm text-red-800">
          {isOwner
            ? 'This permanently deletes your account, your ranch, and every record in it — cows, employees, feed, sales, income, and expenses. This cannot be undone.'
            : "This deletes only your login. The farm's records stay; the owner can add you again later."}
        </Text>
      </View>

      <FormError message={error} />
      <TextField
        label="Confirm your password"
        placeholder="Leave blank if you signed in with Google"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable
        onPress={() => setUnderstood(!understood)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: understood }}
        className="flex-row items-start gap-3"
      >
        <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${understood ? 'border-red-600 bg-red-600' : 'border-slate-300 bg-white'}`}>
          {understood ? <Check size={14} color={colors.white} /> : null}
        </View>
        <Text className="flex-1 text-sm text-slate-700">
          {isOwner ? 'I understand this permanently deletes my account and all of my data.' : 'I understand my login will stop working.'}
        </Text>
      </Pressable>
      <Button label={loading ? 'Deleting Account...' : title} variant="danger" size="lg" loading={loading} disabled={!understood} onPress={handleDelete} />
    </Card>
  );
}
