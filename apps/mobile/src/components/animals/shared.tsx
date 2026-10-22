import { useEffect, useState } from 'react';
import { View, Image, Pressable, Platform, ActivityIndicator, type ImageStyle, type StyleProp } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { Badge, type Tone } from '@/src/components/ui';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  Syringe, Dna, Stethoscope, Baby, Pill, Bug, Scale, StickyNote, Camera, ImagePlus, PawPrint, type LucideIcon,
} from 'lucide-react-native';
import { farmToday } from '@farm/business-logic';
import { API_URL, getAccessToken } from '@/src/lib/apiClient';

// Same labels, statuses and rules as the web app's components/animals/shared.tsx.

export const EVENT_TYPES: {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  breeding?: boolean;
}[] = [
  { value: 'vaccine', label: 'Vaccine', Icon: Syringe, color: '#0369a1', titleLabel: 'Vaccine name', titlePlaceholder: 'e.g. FMD, LSD, Anthrax' },
  { value: 'insemination', label: 'Semen / AI', Icon: Dna, color: '#6d28d9', titleLabel: 'Bull / semen straw', titlePlaceholder: 'e.g. Holstein straw #A12', breeding: true },
  { value: 'pregnancy_check', label: 'Pregnancy check', Icon: Stethoscope, color: '#be185d', titleLabel: 'Checked by', titlePlaceholder: 'e.g. Dr. Rahim', breeding: true },
  { value: 'calving', label: 'Calving', Icon: Baby, color: '#047857', titleLabel: 'Note', titlePlaceholder: 'e.g. Normal delivery', breeding: true },
  { value: 'treatment', label: 'Treatment', Icon: Pill, color: '#b91c1c', titleLabel: 'Illness / medicine', titlePlaceholder: 'e.g. Fever, antibiotic' },
  { value: 'deworming', label: 'Deworming', Icon: Bug, color: '#b45309', titleLabel: 'Medicine', titlePlaceholder: 'e.g. Albendazole' },
  { value: 'weight', label: 'Weight', Icon: Scale, color: '#334155' },
  { value: 'other', label: 'Other', Icon: StickyNote, color: '#334155', titleLabel: 'What happened', titlePlaceholder: 'e.g. Hoof trimming' },
];

export const eventTypeInfo = (type: string) => EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];

export const STATUSES = [
  { value: 'active', label: 'In herd' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
];

const STATUS_TONE: Record<string, Tone> = { active: 'brand', sold: 'neutral', dead: 'danger' };

/** Older records may still say "sick"; show them as they are. */
export function StatusBadge({ status }: { status: string }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status;
  return <Badge label={label} tone={STATUS_TONE[status] ?? 'warning'} />;
}

export const CATEGORIES = [
  { value: 'cow', label: 'Cow' },
  { value: 'heifer', label: 'Heifer' },
  { value: 'calf', label: 'Calf' },
  { value: 'bull', label: 'Bull' },
];

export const categoryLabel = (c?: string | null) => CATEGORIES.find((x) => x.value === c)?.label ?? null;

const PREGNANCY: Record<string, { label: string; tone: Tone }> = {
  pregnant: { label: 'Pregnant', tone: 'pink' },
  inseminated: { label: 'AI done', tone: 'violet' },
  open: { label: 'Not pregnant', tone: 'neutral' },
};

export function PregnancyBadge({ status }: { status: string }) {
  const p = PREGNANCY[status];
  if (!p) return null;
  return <Badge label={p.label} tone={p.tone} />;
}

/** "Overdue 3 d", "Today", "In 5 d". */
export function dueText(daysLeft: number) {
  if (daysLeft < 0) return `Overdue ${-daysLeft} d`;
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} d`;
}

export const dueTone = (daysLeft: number): Tone => (daysLeft < 0 ? 'danger' : daysLeft <= 3 ? 'warning' : 'neutral');

/** A reminder pill: "FMD: In 3 d" with a bell, coloured by how soon it is. */
export function DuePill({ label, daysLeft }: { label: string; daysLeft: number }) {
  return <Badge label={label} tone={dueTone(daysLeft)} />;
}

/** Days from today on the farm's clock to a "YYYY-MM-DD" day. */
export function daysUntil(day: string) {
  return Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(farmToday() + 'T00:00:00Z')) / 86_400_000);
}

/**
 * A photo served by the API. Photos sit behind the login, so the Bearer token
 * has to go with the request: native <Image> sends `headers`, but
 * react-native-web ignores them, so on web the bytes are fetched and shown as
 * a blob URL instead.
 */
export function AnimalPhoto({ url, style }: { url: string | null | undefined; style: StyleProp<ImageStyle> }) {
  const [source, setSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const token = await getAccessToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const uri = API_URL + url;
      if (Platform.OS !== 'web') {
        if (!cancelled) setSource({ uri, headers });
        return;
      }
      const res = await fetch(uri, { headers }).catch(() => null);
      if (!res?.ok || cancelled) return;
      objectUrl = URL.createObjectURL(await res.blob());
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setSource({ uri: objectUrl });
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!url || !source) {
    return (
      <View style={style as object} className="items-center justify-center bg-slate-100">
        <PawPrint size={28} color="#cbd5e1" />
      </View>
    );
  }
  return <Image source={source} style={style} resizeMode="cover" />;
}

export interface PickedPhoto {
  /** Base64 without the data: prefix, as the API wants it. */
  data: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  /** Local URI for the preview. */
  preview: string;
}

const MAX_SIDE = 800;

/**
 * Take or choose a photo and shrink it to at most 800 px on its longest side
 * as a JPEG (about 50-120 KB), like the web app. Null when cancelled.
 */
export async function pickPhoto(from: 'camera' | 'library'): Promise<PickedPhoto | null> {
  // Web needs no permission, and awaiting one there would spend the tap the
  // browser requires before it opens the file chooser.
  if (Platform.OS !== 'web') {
    const permission = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(from === 'camera' ? 'Please allow the camera in your phone settings.' : 'Please allow photo access in your phone settings.');
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const longest = Math.max(asset.width, asset.height);
  const resize = longest > MAX_SIDE
    ? [{ resize: asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
    : [];
  const out = await manipulateAsync(asset.uri, resize, { compress: 0.75, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('This photo could not be read. Please try another one.');
  const data = out.base64.replace(/^data:[^,]*,/, '');
  return { data, mimeType: 'image/jpeg', width: out.width, height: out.height, preview: out.uri };
}

/** Photo field: preview plus "Take photo" / "Choose photo". */
export function PhotoPicker({
  value,
  onChange,
  label = 'Photo',
  required,
}: {
  value: PickedPhoto | null;
  onChange: (p: PickedPhoto | null) => void;
  label?: string;
  required?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(from: 'camera' | 'library') {
    setError('');
    setBusy(true);
    try {
      const photo = await pickPhoto(from);
      if (photo) onChange(photo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label} {required ? <Text className="text-red-600">*</Text> : null}
      </Text>
      <View className="flex-row items-center gap-4">
        <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {value ? (
            <Image source={{ uri: value.preview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : busy ? (
            <ActivityIndicator />
          ) : (
            <Camera size={28} color="#cbd5e1" />
          )}
        </View>
        <View className="flex-1 gap-2">
          {Platform.OS !== 'web' ? (
            <Pressable onPress={() => pick('camera')} disabled={busy} className="flex-row items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2">
              <Camera size={14} color="#334155" />
              <Text className="text-xs font-semibold text-slate-700">Take photo</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => pick('library')} disabled={busy} className="flex-row items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2">
            <ImagePlus size={14} color="#334155" />
            <Text className="text-xs font-semibold text-slate-700">{value ? 'Change' : 'Choose photo'}</Text>
          </Pressable>
          <Text className="text-[11px] text-slate-500">{busy ? 'Preparing photo…' : 'A clear side view helps you recognise the animal.'}</Text>
        </View>
      </View>
      {error ? <Text className="mt-1 text-xs font-medium text-red-600">{error}</Text> : null}
    </View>
  );
}

/** The photo object the API takes (no preview). */
export const photoBody = (p: PickedPhoto) => ({ data: p.data, mimeType: p.mimeType, width: p.width, height: p.height });
