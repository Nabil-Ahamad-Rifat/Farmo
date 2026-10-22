import type { PropsWithChildren } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/components/ui/Text';
import { BrandMark } from '@/src/components/shell/Brand';
import { colors } from '@/src/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

/** "Farm Manager" with the brand mark, like the web's BrandLockup. */
export function BrandLockup() {
  return (
    <View className="flex-row items-center gap-2.5 self-start">
      <BrandMark />
      <Text className="text-[17px] font-bold tracking-tight text-ink">Farm Manager</Text>
    </View>
  );
}

/** Sign-in pages on a phone, like the web's AuthShell: white page, logo, then the form. */
export function AuthShell({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center px-6"
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }}
      >
        <View className="w-full max-w-[400px] self-center">
          <BrandLockup />
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
