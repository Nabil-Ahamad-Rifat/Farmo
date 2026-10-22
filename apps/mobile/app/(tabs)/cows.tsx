import { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, PawPrint } from 'lucide-react-native';
import type { AnimalDueItem, CowListItem } from '@farm/shared-types';
import { ageLabel } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { useCrudList } from '@/src/hooks/useCrudList';
import { Button, Chips, EmptyState, FormError, PageHeader, SearchInput } from '@/src/components/ui';
import { AnimalPhoto, DuePill, PregnancyBadge, StatusBadge, categoryLabel, dueText } from '@/src/components/animals/shared';
import { AnimalFormModal } from '@/src/components/animals/AnimalFormModal';
import { cardShadow } from '@/src/theme';

const FILTERS = [
  { value: 'active', label: 'In herd' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'due', label: 'Due soon' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
  { value: 'all', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

/** Animals, like the web's CowManager: photo grid with breeding and reminder badges. */
export default function AnimalsScreen() {
  const { items: cows, loading, refreshing, refresh, reload, error: loadError } = useCrudList<CowListItem>('/api/cows');
  const [dueSoon, setDueSoon] = useState<AnimalDueItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [suggestedId, setSuggestedId] = useState('');

  const loadDue = useCallback(
    () =>
      mobileApiClient
        .get<AnimalDueItem[]>('/api/animals/due-soon')
        .then(setDueSoon)
        .catch(() => {
          // Reminders are extra; the list still shows without them.
        }),
    [],
  );

  // Load reminders now, and reload everything when coming back from an animal's page.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      loadDue();
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload, loadDue]),
  );

  async function openCreate() {
    const next = await mobileApiClient.get<{ tagNumber: string }>('/api/cows/next-id').catch(() => null);
    setSuggestedId(next?.tagNumber ?? '');
    setAdding(true);
  }

  // The most urgent reminder per animal, for the card badge and the "Due soon" filter.
  const dueByCow = new Map<string, AnimalDueItem>();
  for (const d of dueSoon) if (!dueByCow.has(d.cowId)) dueByCow.set(d.cowId, d);
  const counts: Record<Filter, number> = {
    active: cows.filter((c) => c.status === 'active').length,
    pregnant: cows.filter((c) => c.status === 'active' && c.summary?.pregnancy === 'pregnant').length,
    due: dueByCow.size,
    sold: cows.filter((c) => c.status === 'sold').length,
    dead: cows.filter((c) => c.status === 'dead').length,
    all: cows.length,
  };

  const q = search.trim().toLowerCase();
  const shown = cows.filter((c) => {
    const matchesSearch = !q || c.tagNumber.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.breed ?? '').toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pregnant' ? c.status === 'active' && c.summary?.pregnancy === 'pregnant' : filter === 'due' ? dueByCow.has(c.id) : c.status === filter);
    return matchesSearch && matchesFilter;
  });
  const mothers = cows.filter((c) => c.gender !== 'male').map(({ id, tagNumber, name }) => ({ id, tagNumber, name }));

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperClassName="gap-3"
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              await Promise.all([refresh(), loadDue()]);
            }}
          />
        }
        ListHeaderComponent={
          <View className="mb-1 gap-4">
            <PageHeader
              title="Animals"
              subtitle="Photo, Cow ID, breeding and health records of every animal."
              actions={<Button label="Add animal" icon={Plus} variant="brand" onPress={openCreate} />}
            />
            <FormError message={loadError} />
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search by Cow ID, name or breed..." />
            <Chips options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} value={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={PawPrint}
            message={cows.length === 0 ? 'No animals yet. Add your first animal with a photo.' : 'No animals match this search or filter.'}
            action={cows.length === 0 ? <Button label="Add animal" icon={Plus} onPress={openCreate} /> : undefined}
          />
        }
        renderItem={({ item: c }) => {
          const due = dueByCow.get(c.id);
          const details = [categoryLabel(c.category), c.breed, c.birthDate ? ageLabel(c.birthDate) : null].filter(Boolean).join(' · ');
          return (
            <Pressable
              onPress={() => router.push(`/animal/${c.id}`)}
              style={cardShadow}
              className="max-w-[48.5%] flex-1 overflow-hidden rounded-card border border-line bg-white"
              accessibilityRole="link"
              accessibilityLabel={`${c.tagNumber} ${c.name}`}
            >
              <View>
                <AnimalPhoto url={c.photoUrl} style={{ width: '100%', aspectRatio: 4 / 3 }} />
                <View className="absolute left-2 top-2 rounded-lg bg-ink/85 px-2 py-1">
                  <Text className="font-mono text-xs font-bold text-white">{c.tagNumber}</Text>
                </View>
                {c.status !== 'active' ? (
                  <View className="absolute right-2 top-2">
                    <StatusBadge status={c.status} />
                  </View>
                ) : null}
              </View>
              <View className="gap-2 p-3">
                <View>
                  <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {details || 'No details yet'}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {c.gender !== 'male' && c.summary ? <PregnancyBadge status={c.summary.pregnancy} /> : null}
                  {due ? <DuePill label={`${due.title}: ${dueText(due.daysLeft)}`} daysLeft={due.daysLeft} /> : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <AnimalFormModal
        visible={adding}
        suggestedId={suggestedId}
        mothers={mothers}
        onClose={() => setAdding(false)}
        onSaved={(saved) => {
          setAdding(false);
          reload();
          router.push(`/animal/${saved.id}`);
        }}
      />
    </View>
  );
}
