"use client";

import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { inputCls, labelCls } from '@/components/sales/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Controls';
import { EmptyState, Skeleton } from '@/components/ui/Empty';
import { useConfirm, useToast } from '@/components/ui/Feedback';

type Member = { id: string; name: string | null; email: string; role: string; createdAt: string };

/** Add a manager, rename one, or give one a new password. */
function MemberModal({
  mode,
  member,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'rename' | 'password';
  member?: Member;
  onClose: () => void;
  onSaved: (m: Member) => void;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const saved =
        mode === 'add'
          ? await webApiClient.post<Member>('/api/team', { name, email, password }, 'Failed to add manager')
          : await webApiClient.put<Member>(
              `/api/team/${member!.id}`,
              mode === 'rename' ? { name } : { password },
              'Failed to save',
            );
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'add' ? 'Add manager' : mode === 'rename' ? 'Rename manager' : `New password for ${member!.name || member!.email}`;
  const subtitle =
    mode === 'add'
      ? 'They sign in with this email and password. Managers record daily work and do not see money reports.'
      : mode === 'password'
        ? 'They will be signed out everywhere and must sign in with the new password.'
        : undefined;

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4 pb-2">
        {mode !== 'password' && (
          <div>
            <label htmlFor="member-name" className={labelCls}>Name <span className="text-red-600">*</span></label>
            <input id="member-name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoFocus />
          </div>
        )}
        {mode === 'add' && (
          <div>
            <label htmlFor="member-email" className={labelCls}>Email <span className="text-red-600">*</span></label>
            <input id="member-email" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="off" />
          </div>
        )}
        {mode !== 'rename' && (
          <div>
            <label htmlFor="member-password" className={labelCls}>Password <span className="text-red-600">*</span></label>
            <input
              id="member-password"
              type="password"
              required
              minLength={8}
              maxLength={200}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
              autoFocus={mode === 'password'}
            />
            <p className="mt-1 text-xs text-slate-500">At least 8 characters. Share it with them yourself.</p>
          </div>
        )}
        <FormFooter onCancel={onClose} loading={loading} label={mode === 'add' ? 'Add manager' : 'Save'} />
      </form>
    </Modal>
  );
}

export default function TeamPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' | 'rename' | 'password'; member?: Member } | null>(null);

  // Bumped after every change to fetch the list again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    webApiClient
      .get<Member[]>('/api/team', 'Failed to load team')
      .then((list) => {
        setMembers(list);
        setError('');
      })
      .catch((err: Error) => setError(err.message));
  }, [version]);

  async function remove(m: Member) {
    const ok = await confirm({
      title: `Remove ${m.name || m.email}?`,
      body: 'Their login stops working at once. Records they added stay on the farm.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await webApiClient.delete(`/api/team/${m.id}`, 'Failed to remove manager');
      toast(`${m.name || m.email} removed`);
      reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  function saved(m: Member) {
    const mode = modal?.mode;
    setModal(null);
    toast(mode === 'add' ? `${m.name} can now sign in` : mode === 'password' ? 'Password changed; they were signed out' : 'Saved');
    reload();
  }

  const managers = members?.filter((m) => m.role === 'manager') ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Team"
        subtitle="Give managers their own login. They record sales, feed, animals and worker days, but cannot see profit, history, reports or settings."
        actions={
          <Button onClick={() => setModal({ mode: 'add' })}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Add manager
          </Button>
        }
      />

      {error && (
        <div role="alert" className="rounded-control border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader Icon={Users} title="People on this farm" subtitle={members ? `${members.length} ${members.length === 1 ? 'person' : 'people'}` : undefined} />
        {!members ? (
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => {
              const manager = m.role === 'manager';
              return (
                <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                      {(m.name || m.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                        {m.name || m.email}
                        <Badge tone={manager ? 'info' : 'brand'}>{manager ? 'Manager' : 'Owner'}</Badge>
                      </p>
                      <p className="truncate text-xs text-slate-500">{m.email}</p>
                    </div>
                  </div>
                  {manager && (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setModal({ mode: 'rename', member: m })}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setModal({ mode: 'password', member: m })}>
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> New password
                      </Button>
                      <Button variant="dangerSoft" size="sm" onClick={() => remove(m)} aria-label={`Remove ${m.name || m.email}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {members && managers.length === 0 && (
          <div className="border-t border-line">
            <EmptyState
              Icon={UserPlus}
              title="No managers yet"
              body="Add a manager so someone else can record the farm's daily work with their own login."
              action={<Button variant="secondary" onClick={() => setModal({ mode: 'add' })}>Add manager</Button>}
            />
          </div>
        )}
      </Card>

      {modal && <MemberModal mode={modal.mode} member={modal.member} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}
