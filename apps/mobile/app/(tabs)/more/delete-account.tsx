import { ScrollView } from 'react-native';
import { PageHeader } from '@/src/components/ui';
import { DeleteAccountCard } from '@/src/components/DeleteAccountCard';

/** Managers reach this from More; owners delete their account from Settings. */
export default function DeleteAccountScreen() {
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-4 pb-10" keyboardShouldPersistTaps="handled">
      <PageHeader title="Delete my login" back="More" />
      <DeleteAccountCard />
    </ScrollView>
  );
}
