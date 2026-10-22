import { Pressable, ActivityIndicator, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { colors } from '@/src/theme';

// Same variants as the web's components/ui/Button.tsx: primary (ink) for the
// page's main action, brand for positive money actions (collect, pay, add),
// secondary/ghost for the rest, danger/dangerSoft for deleting.
export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft' | 'amber';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BOX: Record<ButtonVariant, string> = {
  primary: 'bg-ink',
  brand: 'bg-brand-600',
  secondary: 'border border-line bg-white',
  ghost: '',
  danger: 'bg-red-600',
  dangerSoft: 'border border-red-200 bg-white',
  amber: 'bg-amber-600',
};

const TEXT: Record<ButtonVariant, string> = {
  primary: 'text-white',
  brand: 'text-white',
  secondary: 'text-slate-700',
  ghost: 'text-slate-700',
  danger: 'text-white',
  dangerSoft: 'text-red-600',
  amber: 'text-white',
};

const ICON: Record<ButtonVariant, string> = {
  primary: colors.white,
  brand: colors.white,
  secondary: '#334155',
  ghost: '#334155',
  danger: colors.white,
  dangerSoft: colors.red600,
  amber: colors.white,
};

const SIZE: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  sm: { box: 'h-9 px-3 gap-1.5', text: 'text-xs', icon: 14 },
  md: { box: 'h-10 px-4 gap-1.5', text: 'text-sm', icon: 16 },
  lg: { box: 'h-11 px-5 gap-2', text: 'text-sm', icon: 16 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  className = '',
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  const off = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center rounded-control ${s.box} ${BOX[variant]} ${off ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ICON[variant]} />
      ) : (
        <>
          {Icon ? <Icon size={s.icon} color={ICON[variant]} /> : null}
          <Text className={`font-semibold ${s.text} ${TEXT[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Square icon-only button (40×40), e.g. edit/delete on a row. */
export function IconButton({
  icon: Icon,
  onPress,
  variant = 'default',
  color,
  label,
}: {
  icon: LucideIcon;
  onPress: () => void;
  variant?: 'default' | 'danger' | 'brand' | 'amber';
  color?: string;
  label?: string;
}) {
  const tone = {
    default: { box: 'border border-line bg-white', color: colors.slate500 },
    danger: { box: 'border border-red-200 bg-white', color: colors.red600 },
    brand: { box: 'bg-brand-50', color: colors.brand600 },
    amber: { box: 'bg-amber-50', color: colors.amber700 },
  }[variant];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className={`h-10 w-10 items-center justify-center rounded-control ${tone.box}`}>
      <Icon size={16} color={color ?? tone.color} />
    </Pressable>
  );
}

/** A row of buttons that wrap on narrow phones. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}
