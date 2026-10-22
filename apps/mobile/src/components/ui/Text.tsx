import { createContext, use, forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextProps, type TextInputProps } from 'react-native';
import { fonts } from '@/src/theme';

// Plus Jakarta Sans for every text. Android can't make a custom font bold by
// fontWeight, so the weight class (font-bold, font-semibold...) picks the
// matching font file instead and fontWeight is reset. Nested text without a
// weight class keeps its parent's weight, as on the web.

const WEIGHTS: [RegExp, string][] = [
  [/\bfont-(extrabold|black)\b/, fonts.extrabold],
  [/\bfont-bold\b/, fonts.bold],
  [/\bfont-semibold\b/, fonts.semibold],
  [/\bfont-medium\b/, fonts.medium],
  [/\bfont-(normal|light|thin)\b/, fonts.regular],
];

function familyFor(className: string | undefined): string | null {
  if (!className) return null;
  if (/\bfont-mono\b/.test(className)) return 'monospace';
  for (const [re, family] of WEIGHTS) if (re.test(className)) return family;
  return null;
}

const FamilyContext = createContext<string>(fonts.regular);

export function Text({ className, style, ...props }: TextProps & { className?: string }) {
  const inherited = use(FamilyContext);
  const fontFamily = familyFor(className) ?? inherited;
  return (
    <FamilyContext value={fontFamily}>
      <RNText className={className} style={[style, { fontFamily, fontWeight: 'normal' }]} {...props} />
    </FamilyContext>
  );
}

export const TextInput = forwardRef<RNTextInput, TextInputProps & { className?: string }>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} style={[style, { fontFamily: fonts.regular }]} {...props} />;
});
