import { View, Pressable } from 'react-native';
import { Text } from './Text';
import { FieldLabel } from './TextField';

export interface ChipOption {
  value: string;
  label: string;
}

// Single choice as wrapping chips, used in forms (status, category, pay type)
// and older filter bars. Active = ink, like the web's ChoiceChips.
export function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      {label ? <FieldLabel label={label} /> : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              className={`rounded-control px-3.5 py-2.5 ${active ? 'bg-ink' : 'border border-line bg-white'}`}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
