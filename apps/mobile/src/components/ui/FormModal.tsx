import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors } from '@/src/theme';

/** Bottom sheet for a form, like the web's Modal on phones: sticky title, scrolling body, optional sticky footer. */
export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Sticky footer, usually <FormFooter />. */
  footer?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-navy-950/50">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close" />
        <View className="max-h-[92%] rounded-t-2xl bg-white">
          <View className="flex-row items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
            <View className="flex-1">
              <Text className="text-lg font-bold text-ink">{title}</Text>
              {subtitle ? <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-control" accessibilityLabel="Close">
              <X size={20} color={colors.slate400} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-4 px-5 pt-4"
            contentContainerStyle={{ paddingBottom: footer ? 16 : insets.bottom + 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View className="border-t border-slate-100 px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Cancel + submit row for a form sheet, like the web's FormFooter. */
export function FormFooter({ onCancel, onSubmit, label, loading }: { onCancel: () => void; onSubmit: () => void; label: string; loading?: boolean }) {
  return (
    <View className="flex-row gap-2">
      <Button label="Cancel" variant="secondary" size="lg" className="flex-1" onPress={onCancel} />
      <Button label={loading ? 'Saving…' : label} size="lg" className="flex-[2]" loading={loading} onPress={onSubmit} />
    </View>
  );
}
