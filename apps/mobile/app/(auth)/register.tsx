import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { registerSchema } from '@farm/shared-validation';
import { Text } from '@/src/components/ui/Text';
import { useSession } from '@/src/context/AuthContext';
import { GoogleSignInButton } from '@/src/components/GoogleSignInButton';
import { isGoogleSignInConfigured } from '@/src/lib/googleAuth';
import { Button, FormError, TextField } from '@/src/components/ui';
import { AuthShell } from './_layout';

export default function RegisterScreen() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    const parsed = registerSchema.safeParse({ name, email, password, tenantName: tenantName || undefined });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.path[0] === 'password' ? 'Password must be at least 8 characters' : 'Name, a valid email, and password are required');
      return;
    }

    setLoading(true);
    try {
      await signUp(parsed.data.name, parsed.data.email, parsed.data.password, parsed.data.tenantName);
      router.replace('/(tabs)');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <Text className="mt-6 text-2xl font-bold tracking-tight text-ink">Create your account</Text>
      <Text className="mt-1 text-sm text-slate-500">Set up your farm in a minute. You can add workers, animals and customers after.</Text>

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
            <Text className="mx-3 text-xs font-medium text-slate-500">or sign up with email</Text>
            <View className="flex-1 border-t border-line" />
          </View>
        </View>
      ) : null}

      <View className="mt-6 gap-4">
        <TextField label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Mohammad Karim" autoCapitalize="words" autoComplete="name" />
        <TextField
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />
        <TextField label="Farm name" value={tenantName} onChangeText={setTenantName} placeholder="e.g. Amdad Dairy Farm" autoCapitalize="words" />

        <Button
          label={loading ? 'Creating Account...' : 'Get Started'}
          size="lg"
          loading={loading}
          onPress={handleSubmit}
          className="mt-2"
        />
      </View>

      <View className="mt-6 flex-row justify-center gap-1">
        <Text className="text-sm text-slate-500">Already have an account?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link">
            <Text className="text-sm font-semibold text-brand-700">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
