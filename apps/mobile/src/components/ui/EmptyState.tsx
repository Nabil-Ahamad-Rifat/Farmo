import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Inbox, type LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { colors } from '@/src/theme';

/** Empty list: icon tile, title, text and an optional action, like the web's EmptyState. */
export function EmptyState({
  message,
  title,
  icon: Icon = Inbox,
  action,
}: {
  /** Body text (older screens pass only this). */
  message?: string;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <View className="items-center gap-2 px-6 py-10">
      <View className="mb-1 h-12 w-12 items-center justify-center rounded-card bg-slate-100">
        <Icon size={22} color={colors.slate400} />
      </View>
      {title ? <Text className="text-center text-base font-semibold text-ink">{title}</Text> : null}
      {message ? <Text className="text-center text-sm text-slate-500">{message}</Text> : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
