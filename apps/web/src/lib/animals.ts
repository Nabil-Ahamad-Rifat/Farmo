// Animal records: photos (stored in the database), history events, and the
// status/reminders worked out from them by @farm/business-logic.
import type { Cow, Prisma } from '@prisma/client';
import { animalSummary, dueSoon, nextAnimalId } from '@farm/business-logic';
import { db } from '@/lib/db';
import { isObjectId } from '@/lib/receivables';
import { rateLimitUser } from '@/lib/rate-limit';

type Tx = Prisma.TransactionClient;

/**
 * Largest new photo accepted after decoding. Clients shrink photos to 800 px
 * (about 50-120 KB) first; the cap keeps the free 512 MB database from filling up.
 */
export const MAX_PHOTO_BYTES = 600 * 1024;
/** Most photos one animal can have. */
export const MAX_PHOTOS_PER_ANIMAL = 8;

/** Per-user cap on photo uploads (each one costs database space): 60 an hour. */
export function photoUploadAllowed(userId: string): Promise<boolean> {
  return rateLimitUser(userId, 'photo-upload', 60, 60 * 60 * 1000);
}

export const photoUrl = (cowId: string, photoId: string) => `/api/cows/${cowId}/photos/${photoId}`;

const eventSelect = { type: true, date: true, title: true, nextDueDate: true, result: true, value: true, cost: true } satisfies Prisma.AnimalEventSelect;

/** Decoded photo bytes, or an error message for the client. Checks the file really is the image type it claims. */
export function decodePhoto(photo: { data: string; mimeType: string }): { bytes: Buffer } | { error: string } {
  const bytes = Buffer.from(photo.data.replace(/\s/g, ''), 'base64');
  if (bytes.length < 100) return { error: 'Photo is empty or damaged' };
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'Photo is too large (max 600 KB); please use a smaller picture' };
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes.subarray(0, 4).toString('hex') === '89504e47';
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const ok = { 'image/jpeg': isJpeg, 'image/png': isPng, 'image/webp': isWebp }[photo.mimeType];
  if (!ok) return { error: 'Please choose a JPEG, PNG or WebP photo' };
  return { bytes };
}

/** Save a decoded photo for an animal and return its id. */
export async function savePhoto(
  tx: Tx,
  tenantId: string,
  cowId: string,
  bytes: Buffer,
  photo: { mimeType: string; width?: number; height?: number; caption?: string },
) {
  const saved = await tx.animalPhoto.create({
    data: {
      tenantId,
      cowId,
      data: new Uint8Array(bytes),
      mimeType: photo.mimeType,
      width: photo.width ?? null,
      height: photo.height ?? null,
      size: bytes.length,
      caption: photo.caption ?? null,
    },
    select: { id: true },
  });
  return saved.id;
}

/** What clients get for an animal: the cow, its main photo URL and its status from its records. */
export function presentAnimal<T extends Cow>(cow: T, events: Parameters<typeof animalSummary>[0]) {
  return {
    ...cow,
    photoUrl: cow.mainPhotoId ? photoUrl(cow.id, cow.mainPhotoId) : null,
    summary: animalSummary(events),
  };
}

/** Every animal of the farm with status and photo, newest first. */
export async function listAnimals(tenantId: string) {
  const [cows, events] = await Promise.all([
    db.cow.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    db.animalEvent.findMany({ where: { tenantId }, select: { ...eventSelect, cowId: true } }),
  ]);
  const byCow = new Map<string, typeof events>();
  for (const e of events) byCow.set(e.cowId, [...(byCow.get(e.cowId) ?? []), e]);
  return cows.map((c) => presentAnimal(c, byCow.get(c.id) ?? []));
}

/** One animal with mother, calves, photos, history (newest first) and status. Null if not in this farm. */
export async function getAnimalDetail(tenantId: string, id: string) {
  if (!isObjectId(id)) return null;
  const cow = await db.cow.findFirst({ where: { id, tenantId } });
  if (!cow) return null;

  const [events, photos, mother, calves] = await Promise.all([
    db.animalEvent.findMany({ where: { tenantId, cowId: id }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    db.animalPhoto.findMany({
      where: { tenantId, cowId: id },
      // Never send the image bytes here; clients load each photo by URL.
      select: { id: true, width: true, height: true, size: true, caption: true, takenAt: true },
      orderBy: { takenAt: 'desc' },
    }),
    cow.motherId ? db.cow.findFirst({ where: { id: cow.motherId, tenantId }, select: { id: true, tagNumber: true, name: true } }) : null,
    db.cow.findMany({
      where: { tenantId, motherId: id },
      select: { id: true, tagNumber: true, name: true, gender: true, birthDate: true, mainPhotoId: true },
      orderBy: { birthDate: 'desc' },
    }),
  ]);

  return {
    ...presentAnimal(cow, events),
    mother,
    calves: calves.map(({ mainPhotoId, ...c }) => ({ ...c, photoUrl: mainPhotoId ? photoUrl(c.id, mainPhotoId) : null })),
    // Main photo first.
    photos: photos
      .map((p) => ({ ...p, url: photoUrl(id, p.id) }))
      .sort((a, b) => Number(b.id === cow.mainPhotoId) - Number(a.id === cow.mainPhotoId)),
    events,
  };
}

/** Vaccines/deworming due, calvings expected and pregnancy checks due for the farm's active animals. */
export async function getDueSoon(tenantId: string, now = new Date()) {
  const [cows, events] = await Promise.all([
    db.cow.findMany({ where: { tenantId, status: 'active' }, select: { id: true, tagNumber: true, name: true } }),
    db.animalEvent.findMany({ where: { tenantId }, select: { ...eventSelect, cowId: true } }),
  ]);
  const byCow = new Map<string, typeof events>();
  for (const e of events) byCow.set(e.cowId, [...(byCow.get(e.cowId) ?? []), e]);
  return dueSoon(cows.map((c) => ({ ...c, events: byCow.get(c.id) ?? [] })), now);
}

/** Every animal record with a cost (vet, medicine, vaccine, semen...), newest first, for the expense list. */
export async function listAnimalCosts(tenantId: string) {
  const [events, cows] = await Promise.all([
    db.animalEvent.findMany({
      where: { tenantId, cost: { gt: 0 } },
      select: { id: true, cowId: true, type: true, title: true, cost: true, date: true },
      orderBy: { date: 'desc' },
    }),
    db.cow.findMany({ where: { tenantId }, select: { id: true, tagNumber: true, name: true } }),
  ]);
  const byId = new Map(cows.map((c) => [c.id, c]));
  return events.map((e) => ({
    id: e.id,
    cowId: e.cowId,
    tagNumber: byId.get(e.cowId)?.tagNumber ?? '?',
    animalName: byId.get(e.cowId)?.name ?? '',
    type: e.type,
    title: e.title,
    amount: e.cost!,
    date: e.date,
  }));
}

/** The suggested Cow ID for the next animal (C-001, C-002...). */
export async function suggestAnimalId(tenantId: string) {
  const cows = await db.cow.findMany({ where: { tenantId }, select: { tagNumber: true } });
  return nextAnimalId(cows.map((c) => c.tagNumber));
}

/** Another animal in this farm already uses this Cow ID (case-insensitive). */
export async function tagTaken(tenantId: string, tagNumber: string, exceptId?: string) {
  const clash = await db.cow.findFirst({
    where: { tenantId, tagNumber: { equals: tagNumber, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!clash;
}

/** "YYYY-MM-DD" -> noon UTC, the convention used for every stored day. */
export const dayOrNull = (day: string | undefined) => (day ? new Date(day + 'T12:00:00Z') : null);

/** Fields of a validated animal form, as stored. Blank name falls back to the Cow ID. */
export function animalData(a: {
  tagNumber: string;
  name?: string;
  breed?: string;
  color?: string;
  gender: string;
  category?: string;
  birthDate?: string;
  source?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  motherId?: string;
  status: string;
  notes?: string;
}) {
  return {
    tagNumber: a.tagNumber,
    name: a.name ?? a.tagNumber,
    breed: a.breed ?? null,
    color: a.color ?? null,
    gender: a.gender,
    category: a.category ?? null,
    birthDate: dayOrNull(a.birthDate),
    source: a.source ?? null,
    purchaseDate: a.source === 'purchased' ? dayOrNull(a.purchaseDate) : null,
    purchasePrice: a.source === 'born' ? null : a.purchasePrice ?? null,
    motherId: a.motherId ?? null,
    status: a.status,
    notes: a.notes ?? null,
  };
}

/** Error text if `motherId` isn't a female animal of this farm (or is the animal itself), else null. */
export async function checkMother(tenantId: string, motherId: string | undefined, selfId?: string) {
  if (!motherId) return null;
  if (motherId === selfId) return 'An animal cannot be its own mother';
  if (!isObjectId(motherId)) return 'Mother not found';
  const mother = await db.cow.findFirst({ where: { id: motherId, tenantId }, select: { gender: true } });
  if (!mother) return 'Mother not found';
  if (mother.gender === 'male') return 'The mother must be a female animal';
  return null;
}

/** Event fields as stored, from a validated record. */
export function eventData(e: {
  type: string;
  date: string;
  title?: string;
  nextDueDate?: string;
  result?: string;
  value?: number;
  cost?: number;
  notes?: string;
}) {
  return {
    type: e.type,
    date: dayOrNull(e.date)!,
    title: e.title ?? null,
    // Only doses repeat on a schedule.
    nextDueDate: e.type === 'vaccine' || e.type === 'deworming' ? dayOrNull(e.nextDueDate) : null,
    result: e.type === 'pregnancy_check' ? e.result ?? null : null,
    value: e.type === 'weight' ? e.value ?? null : null,
    cost: e.cost ?? null,
    notes: e.notes ?? null,
  };
}
