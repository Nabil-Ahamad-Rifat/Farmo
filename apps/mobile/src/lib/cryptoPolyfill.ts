// Gives React Native the standard crypto.getRandomValues (backed by the
// phone's secure random source via expo-crypto). Backup encryption needs it
// for salts and nonces. Imported first in app/_layout.tsx.
import * as ExpoCrypto from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T } };
if (!g.crypto?.getRandomValues) {
  g.crypto = {
    ...(g.crypto ?? {}),
    getRandomValues: <T extends ArrayBufferView | null>(array: T) => ExpoCrypto.getRandomValues(array as never) as T,
  };
}
