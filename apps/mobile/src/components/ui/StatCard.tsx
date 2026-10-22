import { View, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { ArrowUpRight, type LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { cardShadow, colors } from '@/src/theme';

export type StatTone = 'neutral' | 'brand' | 'danger' | 'warning' | 'info';

const TONE: Record<StatTone, { chip: string; icon: string; value: string }> = {
  neutral: { chip: 'bg-slate-100', icon: colors.slate600, value: 'text-ink' },
  brand: { chip: 'bg-brand-50', icon: colors.brand600, value: 'text-ink' },
  danger: { chip: 'bg-red-50', icon: colors.red600, value: 'text-red-600' },
  warning: { chip: 'bg-amber-50', icon: colors.amber700, value: 'text-ink' },
  info: { chip: 'bg-sky-50', icon: colors.sky700, value: 'text-ink' },
};

/** Number card like the web's StatCard: label, icon chip, value, hint, optional link. */
export function StatCard({
  label,
  value,
  hint,
  subtext,
  icon: Icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Older name for hint. */
  subtext?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Older screens pass a colour; ignored in favour of tone. */
  color?: string;
  href?: Href;
}) {
  const t = TONE[tone];
  const body = (
    <>
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</Text>
        {href ? <ArrowUpRight size={14} color={colors.slate400} /> : Icon ? (
          <View className={`h-8 w-8 items-center justify-center rounded-control ${t.chip}`}>
            <Icon size={16} color={t.icon} />
          </View>
        ) : null}
      </View>
      <Text className={`mt-1.5 text-xl font-bold ${t.value}`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ?? subtext ? <Text className="mt-0.5 text-xs text-slate-500">{hint ?? subtext}</Text> : null}
    </>
  );
  const cls = 'min-w-[45%] flex-1 rounded-card border border-line bg-white p-4';
  return href ? (
    <Pressable onPress={() => router.push(href)} style={cardShadow} className={cls} accessibilityRole="link">
      {body}
    </Pressable>
  ) : (
    <View style={cardShadow} className={cls}>
      {body}
    </View>
  );
}

/** Two-column grid of StatCards. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}
