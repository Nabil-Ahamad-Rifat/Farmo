import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { loginSchema } from '@farm/shared-validation';
import { Text } from '@/src/components/ui/Text';
import { useSession } from '@/src/context/AuthContext';
import { GoogleSignInButton } from '@/src/components/GoogleSignInButton';
import { isGoogleSignInConfigured } from '@/src/lib/googleAuth';
import { Button, FormError, TextField } from '@/src/components/ui';
import { AuthShell } from './_layout';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter a valid email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Text className="mt-6 text-2xl font-bold tracking-tight text-ink">Welcome back</Text>
      <Text className="mt-1 text-sm text-slate-500">Sign in to your farm management account.</Text>

      {error ? (
        <View className="mt-4">
          <FormError message={error} />
        </View>
      ) : null}

      {isGoogleSignInConfigured ? (
        <View className="mt-6 gap-5">
          <GoogleSignInButton onError={setError} />
          <View className="flex-row items-center">
            <View className="flex-1 border-t border-line" />
            <Text className="mx-3 text-xs font-medium text-slate-500">or sign in with email</Text>
            <View className="flex-1 border-t border-line" />
          </View>
        </View>
      ) : null}

      <View className="mt-6 gap-4">
        <TextField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="owner@farm.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
        />
        <View>
          <View className="absolute right-0 top-0 z-10">
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable accessibilityRole="link">
                <Text className="text-[11px] font-semibold text-brand-700">Forgot password?</Text>
              </Pressable>
            </Link>
          </View>
          <TextField label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry autoComplete="password" onSubmitEditing={handleSubmit} />
        </View>

        <Button label={loading ? 'Signing in...' : 'Continue to Dashboard'} size="lg" loading={loading} onPress={handleSubmit} className="mt-2" />
      </View>

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-sm text-slate-500">Don&apos;t have an account?</Text>
        <Link href="/(auth)/register" asChild>
          <Pressable accessibilityRole="link">
            <Text className="text-sm font-semibold text-brand-700">Create farm account</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
