import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { UserPlus, Users } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { useSession } from '@/src/context/AuthContext';
import { useOwnerOnly } from '@/src/hooks/useOwnerOnly';
import {
  Badge, Button, Card, CardHeader, EmptyState, FormError, FormFooter, FormModal, PageHeader, TextField, useConfirm, useToast,
} from '@/src/components/ui';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

type ModalState = { mode: 'add' } | { mode: 'rename' | 'password'; member: Member } | null;

/** Owner's Team screen, like the web's /dashboard/settings/team. */
export default function TeamScreen() {
  const allowed = useOwnerOnly();
  return allowed ? <TeamScreenContent /> : null;
}

function TeamScreenContent() {
  const { user } = useSession();
  const confirm = useConfirm();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await mobileApiClient.get<Member[]>('/api/team', 'Failed to load team'));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    // State is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(m: Member) {
    const ok = await confirm({
      title: `Remove ${m.name || m.email}?`,
      message: 'Their login stops working at once. Records they added stay on the farm.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await mobileApiClient.delete(`/api/team/${m.id}`, 'Failed to remove manager');
      toast(`${m.name || m.email} removed`);
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const managers = members?.filter((m) => m.role === 'manager') ?? [];
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-5 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <PageHeader
        eyebrow="Settings"
        title="Team"
        subtitle="Give managers their own login. They record sales, feed, animals and worker days, but cannot see profit, history, reports or settings."
        actions={<Button label="Add manager" icon={UserPlus} onPress={() => setModal({ mode: 'add' })} />}
      />
      <FormError message={error} />

      <Card padded={false}>
        <CardHeader icon={Users} title="People on this farm" subtitle={members ? `${members.length} ${members.length === 1 ? 'person' : 'people'}` : undefined} />
        {!members ? (
          <View className="py-10">{error ? null : <ActivityIndicator />}</View>
        ) : (
          members.map((m) => {
            const manager = m.role === 'manager';
            return (
              <View key={m.id} className="gap-3 border-b border-slate-100 px-4 py-3.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-ink">
                    <Text className="text-base font-bold text-white">{(m.name || m.email).charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {m.name || m.email}
                        {m.id === user?.id ? ' (you)' : ''}
                      </Text>
                      <Badge label={manager ? 'Manager' : 'Owner'} tone={manager ? 'info' : 'brand'} />
                    </View>
                    <Text className="text-xs text-slate-500" numberOfLines={1}>{m.email}</Text>
                  </View>
                </View>
                {manager ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Button label="Rename" variant="secondary" size="sm" onPress={() => setModal({ mode: 'rename', member: m })} />
                    <Button label="New password" variant="secondary" size="sm" onPress={() => setModal({ mode: 'password', member: m })} />
                    <Button label="Remove" variant="dangerSoft" size="sm" onPress={() => remove(m)} />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
        {members && managers.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No managers yet"
            message="Add a manager so someone else can record the farm's daily work with their own login."
            action={<Button label="Add manager" variant="secondary" onPress={() => setModal({ mode: 'add' })} />}
          />
        ) : null}
      </Card>

      {modal ? (
        <MemberModal
          state={modal}
          onClose={() => setModal(null)}
          onSaved={(m) => {
            const mode = modal.mode;
            setModal(null);
            toast(mode === 'add' ? `${m.name} can now sign in` : mode === 'password' ? 'Password changed; they were signed out' : 'Saved');
            load();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function MemberModal({ state, onClose, onSaved }: { state: NonNullable<ModalState>; onClose: () => void; onSaved: (m: Member) => void }) {
  const member = state.mode === 'add' ? undefined : state.member;
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const saved =
        state.mode === 'add'
          ? await mobileApiClient.post<Member>('/api/team', { name, email, password }, 'Failed to add manager')
          : await mobileApiClient.put<Member>(`/api/team/${member!.id}`, state.mode === 'rename' ? { name } : { password }, 'Failed to save');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const title = state.mode === 'add' ? 'Add manager' : state.mode === 'rename' ? 'Rename manager' : `New password for ${member!.name || member!.email}`;
  const subtitle =
    state.mode === 'add'
      ? 'They sign in with this email and password. Managers record daily work and do not see money reports.'
      : state.mode === 'password'
        ? 'They will be signed out everywhere and must sign in with the new password.'
        : undefined;

  return (
    <FormModal
      visible
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={loading} label={state.mode === 'add' ? 'Add manager' : 'Save'} />}
    >
      <FormError message={error} />
      {state.mode !== 'password' ? <TextField label="Name *" value={name} onChangeText={setName} autoCapitalize="words" /> : null}
      {state.mode === 'add' ? (
        <TextField label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      ) : null}
      {state.mode !== 'rename' ? (
        <TextField
          label="Password *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          hint="At least 8 characters. Share it with them yourself."
        />
      ) : null}
    </FormModal>
  );
}
