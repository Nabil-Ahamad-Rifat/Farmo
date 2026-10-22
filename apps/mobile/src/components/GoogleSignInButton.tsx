import { useEffect, useState } from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { isGoogleSignInConfigured, useGoogleAuthRequest } from '@/src/lib/googleAuth';
import { useSession } from '@/src/context/AuthContext';

interface Props {
  onError: (message: string) => void;
}

// Split so useGoogleAuthRequest() (and the AuthRequest it builds) is never
// invoked at all when no Google client ID is configured — see the warning
// in src/lib/googleAuth.ts. isGoogleSignInConfigured is a module-level
// constant from build-time env vars, so it can't change between renders,
// making this early return safe despite normally being a rules-of-hooks
// violation.
export function GoogleSignInButton({ onError }: Props) {
  if (!isGoogleSignInConfigured) return null;
  return <GoogleSignInButtonInner onError={onError} />;
}

function GoogleSignInButtonInner({ onError }: Props) {
  const { signInWithGoogle } = useSession();
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.authentication?.idToken;
    if (!idToken) {
      onError('Google did not return a usable credential. Please try again.');
      return;
    }
    // Synchronous — must flip the button into its spinner state the instant
    // Google hands back a credential, not the derived-state anti-pattern
    // this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    signInWithGoogle(idToken)
      .catch((err: unknown) => onError((err as Error).message))
      .finally(() => setLoading(false));
    // signInWithGoogle/onError are stable enough for this one-shot effect;
    // re-running on every render would re-fire the sign-in call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Pressable
      disabled={!request || loading}
      onPress={() => promptAsync()}
      className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 disabled:opacity-50"
    >
      {loading ? <ActivityIndicator color="white" /> : <Text className="text-sm font-semibold text-white">Continue with Google</Text>}
    </Pressable>
  );
}
