import { View, Pressable, ScrollView } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Text, TextInput } from './Text';
import { colors } from '@/src/theme';

export type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'info' | 'violet' | 'pink';

const BADGE: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  pink: 'border-pink-200 bg-pink-50 text-pink-700',
};

/** Rounded pill, like the web's Badge. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className="self-start">
      <Text className={`overflow-hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE[tone]}`}>{label}</Text>
    </View>
  );
}

export interface ChipItem<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

/** Filter chips in one swipeable row (active = ink), like the web's Chips on phones. */
export function Chips<T extends string>({ options, value, onChange }: { options: ChipItem<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" className="-mx-4" contentContainerStyle={{ paddingHorizontal: 16 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`flex-row items-center gap-1.5 rounded-full px-4 py-2.5 ${active ? 'bg-ink' : 'border border-line bg-white'}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{o.label}</Text>
            {o.count != null ? <Text className={`text-xs font-semibold ${active ? 'text-slate-300' : 'text-slate-400'}`}>{o.count}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** On/off chip, e.g. "Owes money". */
export function ToggleChip({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      className={`self-start rounded-full px-4 py-2.5 ${on ? 'bg-red-600' : 'border border-line bg-white'}`}
    >
      <Text className={`text-sm font-semibold ${on ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
    </Pressable>
  );
}

/** Search box with an icon and a clear button. */
export function SearchInput({ value, onChangeText, placeholder, onSubmit }: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit?: () => void }) {
  return (
    <View className="h-11 flex-row items-center gap-2 rounded-control border border-line bg-white px-3">
      <Search size={16} color={colors.slate400} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        className="flex-1 text-base text-ink"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="Clear search" className="p-1">
          <X size={14} color={colors.slate400} />
        </Pressable>
      ) : null}
    </View>
  );
}
