import { View } from 'react-native';
import { CloudUpload } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { Badge } from '@/src/components/ui';
import { usePendingFor } from '@/src/lib/sync';
import { colors } from '@/src/theme';

/**
 * Entries saved offline for this list (matching outbox paths), shown above the
 * list with a "Waiting to sync" badge until they upload. Nothing when empty.
 */
export function PendingEntries({ match }: { match: RegExp | string }) {
  const pending = usePendingFor(match);
  if (pending.length === 0) return null;
  return (
    <View className="overflow-hidden rounded-card border border-amber-200 bg-amber-50">
      {pending.map((e, i) => (
        <View key={e.id} className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-amber-100' : ''}`}>
          <CloudUpload size={16} color={colors.amber700} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
              {e.label}
            </Text>
            <Text className="text-xs text-slate-500">
              Saved {new Date(e.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Badge label="Waiting to sync" tone="warning" />
        </View>
      ))}
    </View>
  );
}
