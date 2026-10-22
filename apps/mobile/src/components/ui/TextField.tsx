import { View, type TextInputProps } from 'react-native';
import { Text, TextInput } from './Text';
import { colors } from '@/src/theme';

/** Label above the field, like the web's labelCls. */
export function FieldLabel({ label }: { label: string }) {
  const required = label.endsWith(' *');
  return (
    <Text className="mb-1.5 text-[13px] font-medium text-slate-700">
      {required ? label.slice(0, -2) : label}
      {required ? <Text className="text-red-600"> *</Text> : null}
    </Text>
  );
}

export function TextField({ label, hint, multiline, ...inputProps }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View>
      <FieldLabel label={label} />
      <TextInput
        placeholderTextColor={colors.slate400}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={`rounded-control border border-line bg-white px-3.5 text-base text-ink ${multiline ? 'min-h-[76px] py-2.5' : 'h-11'}`}
        {...inputProps}
      />
      {hint ? <Text className="mt-1 text-xs text-slate-500">{hint}</Text> : null}
    </View>
  );
}
