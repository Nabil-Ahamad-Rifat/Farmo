import { View, Pressable } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { router } from 'expo-router';
import { BellRing } from 'lucide-react-native';
import type { AnimalDueItem } from '@farm/shared-types';
import { fmtDate } from '@/src/lib/format';
import { Button, Card } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { DuePill, dueText, eventTypeInfo } from './shared';

/** Reminders like the web's DueSoonPanel: vaccines/deworming due, calvings expected and pregnancy checks, soonest first. */
export function DueSoonCard({ items }: { items: AnimalDueItem[] }) {
  if (items.length === 0) return null;
  const overdue = items.filter((i) => i.daysLeft < 0).length;
  return (
    <Card padded={false}>
      <View className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <View className="h-9 w-9 items-center justify-center rounded-control bg-amber-50">
          <BellRing size={16} color={colors.amber700} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-ink">Animals due soon</Text>
          <Text className="text-xs text-slate-500">
            {items.length} reminder{items.length === 1 ? '' : 's'}
            {overdue > 0 ? ` · ${overdue} overdue` : ''}
          </Text>
        </View>
        <Button label="All animals" variant="secondary" size="sm" onPress={() => router.navigate('/cows')} />
      </View>
      {items.slice(0, 8).map((d, i) => {
        const t = eventTypeInfo(d.kind);
        return (
          <Pressable
            key={`${d.cowId}-${d.kind}-${d.dueDate}-${i}`}
            onPress={() => router.push(`/animal/${d.cowId}`)}
            className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
            accessibilityRole="link"
          >
            <View className="h-9 w-9 items-center justify-center rounded-control border border-line">
              <t.Icon size={16} color={t.color} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                {d.tagNumber}
                {d.name !== d.tagNumber ? ` · ${d.name}` : ''}
              </Text>
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                {d.title} · {fmtDate(d.dueDate)}
              </Text>
            </View>
            <DuePill label={dueText(d.daysLeft)} daysLeft={d.daysLeft} />
          </Pressable>
        );
      })}
    </Card>
  );
}
