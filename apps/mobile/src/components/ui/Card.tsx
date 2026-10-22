import type { ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { Text } from './Text';
import { cardShadow, colors } from '@/src/theme';

/** White rounded card with the web's card border and shadow. */
export function Card({ children, className = '', padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <View style={cardShadow} className={`rounded-card border border-line bg-white ${padded ? 'p-4' : 'overflow-hidden'} ${className}`}>
      {children}
    </View>
  );
}

/** Card title row: optional icon tile, title, subtitle and actions on the right. */
export function CardHeader({ title, subtitle, icon: Icon, actions }: { title: string; subtitle?: string; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
      {Icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-control bg-slate-100">
          <Icon size={16} color={colors.slate600} />
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-ink">{title}</Text>
        {subtitle ? <Text className="text-xs text-slate-500">{subtitle}</Text> : null}
      </View>
      {actions}
    </View>
  );
}

/** Page title block, like the web's PageHeader: back link, eyebrow, title, subtitle, actions. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** "← All animals": label for going back. */
  back?: string;
  actions?: ReactNode;
}) {
  return (
    <View className="gap-3">
      {back ? (
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1 self-start" accessibilityRole="link">
          <ChevronLeft size={16} color={colors.slate500} />
          <Text className="text-sm font-medium text-slate-500">{back}</Text>
        </Pressable>
      ) : null}
      <View>
        {eyebrow ? <Text className="text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</Text> : null}
        <Text className="text-2xl font-bold tracking-tight text-ink">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text> : null}
      </View>
      {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
    </View>
  );
}

/** Red box for a form or load error. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-control border border-red-200 bg-red-50 px-3.5 py-2.5" accessibilityRole="alert">
      <Text className="text-sm font-medium text-red-700">{message}</Text>
    </View>
  );
}
