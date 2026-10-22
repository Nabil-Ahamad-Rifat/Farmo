import { Button } from './Button';

/** Full-width form submit button (older screens); same look as the web's primary button. */
export function PrimaryButton({
  label,
  loading,
  onPress,
  variant = 'primary',
}: {
  label: string;
  loading?: boolean;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'brand';
}) {
  return <Button label={label} loading={loading} onPress={onPress} variant={variant} size="lg" />;
}
