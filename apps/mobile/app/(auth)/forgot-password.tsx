import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { forgotPasswordSchema } from '@farm/shared-validation';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { Button, FormError, TextField } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { AuthShell } from './_layout';

// The reset link itself is emailed as a web URL (NEXT_PUBLIC_APP_URL/reset-password?token=...)
// and completed on the web — this screen only requests that link, like the
// web's Forgot password page.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await mobileApiClient.post('/api/auth/forgot-password', { email: parsed.data.email }, 'Failed to process request');
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function backToSignIn() {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  }

  const back = (
    <Pressable onPress={backToSignIn} className="mt-6 flex-row items-center justify-center gap-2 self-center rounded-control border border-line bg-white px-4 py-2.5" accessibilityRole="link">
      <ArrowLeft size={16} color={colors.ink} />
      <Text className="text-sm font-semibold text-ink">Back to sign in</Text>
    </Pressable>
  );

  return (
    <AuthShell>
      {sent ? (
        <View className="mt-8 items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full border border-brand-200 bg-brand-50">
            <CheckCircle2 size={28} color={colors.brand700} />
          </View>
          <Text className="mt-4 text-xl font-bold text-ink">Check your email</Text>
          <Text className="mt-2 text-center text-sm text-slate-500">
            If <Text className="font-medium text-ink">{email}</Text> is registered, you&apos;ll receive a password reset link within a few minutes.
          </Text>
          <Text className="mt-3 text-center text-xs text-slate-500">Don&apos;t see it? Check your spam folder. The link expires in 30 minutes.</Text>
          {back}
        </View>
      ) : (
        <>
          <Text className="mt-6 text-2xl font-bold tracking-tight text-ink">Forgot your password?</Text>
          <Text className="mt-1 text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</Text>

          {error ? (
            <View className="mt-4">
              <FormError message={error} />
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
              onSubmitEditing={handleSubmit}
            />
            <Button label={loading ? 'Sending...' : 'Send Reset Link'} size="lg" loading={loading} onPress={handleSubmit} className="mt-2" />
          </View>

          <Pressable onPress={backToSignIn} className="mt-6 flex-row items-center justify-center gap-1.5" accessibilityRole="link">
            <ArrowLeft size={14} color={colors.slate500} />
            <Text className="text-sm font-semibold text-slate-600">Back to sign in</Text>
          </Pressable>
        </>
      )}
    </AuthShell>
  );
}
