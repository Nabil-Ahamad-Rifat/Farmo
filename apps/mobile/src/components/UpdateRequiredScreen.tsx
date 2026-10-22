import { View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { BrandMark } from '@/src/components/shell/Brand';
import { colors } from '@/src/theme';

// Shown when /api/meta/version reports this build is below forceUpdateBelow
// (see src/lib/version.ts). There's no in-app update mechanism here on
// purpose — the fix is always "go update from the store", which the app
// itself can't do for you.
export function UpdateRequiredScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-8">
      <BrandMark size={40} />
      <View className="h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
        <AlertTriangle size={26} color={colors.amber700} />
      </View>
      <Text className="text-xl font-bold text-ink">Update required</Text>
      <Text className="text-center text-sm text-slate-500">
        This version of Farm Manager is no longer supported. Please update the app from the App Store or Google Play to continue.
      </Text>
    </View>
  );
}
