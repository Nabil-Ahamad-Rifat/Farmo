import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors } from '@/src/theme';

// Toasts and the confirm sheet, like the web's components/ui/Feedback.tsx.
// Replaces Alert.alert, which does nothing on Expo web.

type ToastKind = 'success' | 'error' | 'info';
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'default';
}
interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

interface FeedbackValue {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

function useFeedback() {
  const v = use(FeedbackContext);
  if (!v) throw new Error('useToast/useConfirm need <FeedbackProvider>');
  return v;
}

export function useToast() {
  return useFeedback().toast;
}

/**
 * `await confirm('Delete this sale?')` resolves true when confirmed. Also takes
 * { title, message, confirmLabel, tone }. A plain string is a danger "Delete".
 */
export function useConfirm() {
  const { confirm } = useFeedback();
  return useCallback(
    (what: string | ConfirmOptions, confirmLabel = 'Delete') =>
      confirm(typeof what === 'string' ? { title: 'Are you sure?', message: what, confirmLabel, tone: 'danger' } : what),
    [confirm]
  );
}

const TOAST_ICON = {
  success: { Icon: CheckCircle2, color: colors.brand600 },
  error: { Icon: XCircle, color: colors.red600 },
  info: { Icon: Info, color: colors.sky700 },
};

export function FeedbackProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [toastState, setToastState] = useState<{ message: string; kind: ToastKind; id: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ message, kind, id: Date.now() });
    timer.current = setTimeout(() => setToastState(null), kind === 'error' ? 6000 : 3500);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  function close(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  const t = toastState ? TOAST_ICON[toastState.kind] : null;
  return (
    <FeedbackContext value={{ toast, confirm }}>
      {children}

      {toastState && t ? (
        <View pointerEvents="box-none" className="absolute inset-x-0 px-4" style={{ bottom: insets.bottom + 76 }}>
          <Pressable
            onPress={() => setToastState(null)}
            accessibilityRole="alert"
            className="flex-row items-center gap-3 rounded-card border border-line bg-white px-4 py-3"
            style={{ shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
          >
            <t.Icon size={18} color={t.color} />
            <Text className="flex-1 text-sm font-medium text-ink">{toastState.message}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable className="flex-1 justify-end bg-navy-950/50" onPress={() => close(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} className="gap-4 rounded-t-2xl bg-white p-5" style={{ paddingBottom: insets.bottom + 20 }}>
            <View className="flex-row gap-3">
              <View className={`h-10 w-10 items-center justify-center rounded-full ${pending?.tone === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertTriangle size={18} color={pending?.tone === 'danger' ? colors.red600 : colors.amber700} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{pending?.title}</Text>
                {pending?.message ? <Text className="mt-1 text-sm text-slate-600">{pending.message}</Text> : null}
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button label="Cancel" variant="secondary" size="lg" className="flex-1" onPress={() => close(false)} />
              <Button
                label={pending?.confirmLabel ?? 'Confirm'}
                variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
                size="lg"
                className="flex-[2]"
                onPress={() => close(true)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext>
  );
}
