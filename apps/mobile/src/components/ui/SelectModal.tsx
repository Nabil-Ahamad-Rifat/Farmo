import { useState } from 'react';
import { View, Pressable, Modal, FlatList } from 'react-native';
import { Text } from './Text';
import { FieldLabel } from './TextField';
import { colors } from '@/src/theme';
import { ChevronDown, Check } from 'lucide-react-native';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

// A tappable field that opens a full list picker — used where the option
// count is too large for a ChipGroup to read comfortably (e.g. picking a
// cow to link a sale to).
export function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <FieldLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        className="h-11 flex-row items-center justify-between rounded-control border border-line bg-white px-3.5"
      >
        <Text className={`flex-1 text-base ${selected ? 'text-ink' : 'text-slate-400'}`} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={16} color="#94a3b8" />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-navy-950/50" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-white p-4" onPress={(e) => e.stopPropagation()}>
            <Text className="mb-2 px-2 text-base font-bold text-ink">{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className="flex-row items-center justify-between rounded-control px-3 py-3"
                >
                  <View>
                    <Text className="text-sm font-medium text-slate-900">{item.label}</Text>
                    {item.sublabel ? <Text className="text-xs text-slate-400">{item.sublabel}</Text> : null}
                  </View>
                  {item.value === value ? <Check size={16} color={colors.brand600} /> : null}
                </Pressable>
              )}
              ListEmptyComponent={<Text className="px-3 py-6 text-center text-sm text-slate-400">No options available</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
