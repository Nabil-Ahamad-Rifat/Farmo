import { useMemo, useState } from 'react';
import { View, Pressable, Modal, FlatList } from 'react-native';
import { Text, TextInput } from '@/src/components/ui/Text';
import { ChevronDown, Search, UserPlus, X } from 'lucide-react-native';
import { tk } from '@/src/lib/format';
import { FieldLabel } from '@/src/components/ui';
import { colors } from '@/src/theme';

export interface PickerParty {
  id: string;
  name: string;
  phone?: string | null;
  type?: string;
  totalDue?: number;
  lastMilkPrice?: number | null;
}

/** An existing customer/supplier, or a new one to be created with the sale or purchase. */
export type PartyChoice = { kind: 'existing'; id: string; name: string } | { kind: 'new'; name: string } | null;

/** Search-or-add picker for a customer or supplier (mobile version of the web CustomerPicker). */
export function PartyPickerField({
  label,
  noun,
  parties,
  value,
  onChange,
}: {
  label: string;
  noun: 'customer' | 'supplier';
  parties: PickerParty[];
  value: PartyChoice;
  onChange: (v: PartyChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? parties.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? '').includes(q)) : parties).slice(0, 30),
    [parties, q],
  );
  const exact = parties.some((p) => p.name.trim().toLowerCase() === q);

  const choose = (v: PartyChoice) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <View>
      <FieldLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        className="h-11 flex-row items-center justify-between rounded-control border border-line bg-white px-3.5"
        accessibilityLabel={`Choose ${noun}`}
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Text className={`shrink text-base ${value ? 'font-semibold text-ink' : 'text-slate-400'}`} numberOfLines={1}>{value?.name ?? `Choose ${noun}`}</Text>
          {value?.kind === 'new' ? <Text className="text-xs font-semibold text-brand-700">will be added</Text> : null}
        </View>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityLabel={`Clear ${noun}`}>
            <X size={16} color={colors.slate400} />
          </Pressable>
        ) : (
          <ChevronDown size={16} color={colors.slate400} />
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-navy-950/50" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[80%] rounded-t-2xl bg-white p-4" onPress={(e) => e.stopPropagation()}>
            <View className="mb-3 h-11 flex-row items-center gap-2 rounded-control border border-line px-3">
              <Search size={16} color={colors.slate400} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={`Search ${noun} by name or phone...`}
                placeholderTextColor={colors.slate400}
                className="flex-1 text-base text-ink"
                accessibilityLabel={`Search ${noun}`}
              />
            </View>
            {q && !exact ? (
              <Pressable onPress={() => choose({ kind: 'new', name: query.trim() })} className="mb-1 flex-row items-center gap-2 rounded-control bg-brand-50 px-3 py-3">
                <UserPlus size={16} color={colors.brand600} />
                <Text className="text-sm font-semibold text-brand-700">Add “{query.trim()}” as a new {noun}</Text>
              </Pressable>
            ) : null}
            <FlatList
              data={matches}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable onPress={() => choose({ kind: 'existing', id: item.id, name: item.name })} className="flex-row items-center justify-between rounded-control border-b border-slate-100 px-3 py-3">
                  <Text className="text-base font-medium text-ink">{item.name}</Text>
                  {item.totalDue ? (
                    <Text className="text-xs font-semibold text-red-600">Due {tk(item.totalDue)}</Text>
                  ) : item.phone ? (
                    <Text className="text-xs text-slate-400">{item.phone}</Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={q ? null : <Text className="px-3 py-6 text-center text-sm text-slate-400">No {noun}s yet. Type a name to add one.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
