import { View } from 'react-native';
import { Sprout } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { colors } from '@/src/theme';

/** Sprout on a green square, like the web's BrandMark. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <View className="items-center justify-center rounded-control bg-brand-700" style={{ width: size, height: size }}>
      <Sprout size={Math.round(size * 0.55)} color={colors.white} />
    </View>
  );
}

/** Farm name over "Farm Manager", shown in the navy top bar like the web's FarmBadge. */
export function FarmBadge({ name }: { name: string }) {
  return (
    <View className="flex-1 flex-row items-center gap-2.5">
      <BrandMark />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-white" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-[11px] text-slate-400">Farm Manager</Text>
      </View>
    </View>
  );
}
