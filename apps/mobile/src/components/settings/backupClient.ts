import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { API_URL, getAccessToken, mobileApiClient } from '@/src/lib/apiClient';

// Backup calls go straight to the server, not through mobileApiClient: its GETs
// are saved for offline use, and a backup's photo pages must not fill that
// store. A 401 is fixed by one ordinary call (which refreshes the session).

async function raw(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Client-Type': 'mobile', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers as Record<string, string>) },
    });
  } catch {
    throw new Error('Needs internet — try again when online');
  }
  if (res.status === 401 && !retried) {
    await mobileApiClient.get('/api/backup/storage').catch(() => null);
    return raw(path, init, true);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Request failed');
  }
  return res;
}

export const backupGet = async <T,>(path: string): Promise<T> => (await raw(path)).json() as Promise<T>;
export const backupPost = async <T,>(path: string, body: unknown): Promise<T> =>
  (await raw(path, { method: 'POST', body: JSON.stringify(body) })).json() as Promise<T>;
export const backupBytes = async (path: string): Promise<Uint8Array> => new Uint8Array(await (await raw(path)).arrayBuffer());

/** Save bytes as a file and offer to share it (Drive, WhatsApp, email…); on web, download it. */
export async function shareFile(bytes: Uint8Array, name: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  } else {
    throw new Error('Sharing is not available on this phone');
  }
}

/** Let the owner pick a backup file; returns its bytes and name, or null when cancelled. */
export async function pickBackupFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) return { name: asset.name, bytes: new Uint8Array(await asset.file.arrayBuffer()) };
  return { name: asset.name, bytes: await new File(asset.uri).bytes() };
}
