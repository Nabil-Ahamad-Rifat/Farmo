import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Wallet, Plus, ShoppingBag, AlertCircle, Phone, MapPin, StickyNote, Edit3, Trash2, Wheat, PiggyBank, CheckCircle, ChevronLeft } from 'lucide-react-native';
import type { FeedBatch, SupplierDetail, SupplierPayment } from '@farm/shared-types';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { tk, fmtDate, monthLabel, paymentMethodLabel } from '@/src/lib/format';
import { Button, Card, FormError, IconButton, StatCard, StatGrid, useConfirm, useToast } from '@/src/components/ui';
import { StatusPill } from '@/src/components/StatusPill';
import { PaymentModal } from '@/src/components/PaymentModal';
import { FeedPurchaseModal } from '@/src/components/FeedPurchaseModal';
import { SupplierFormModal } from '@/src/components/SupplierFormModal';
import { groupByMonth } from '@/src/components/MonthSection';
import { colors } from '@/src/theme';

type ModalState = { kind: 'purchase'; batch: FeedBatch | null } | { kind: 'payment'; payment: SupplierPayment | null } | { kind: 'supplier' } | null;

/** One supplier, like the web's SupplierDetailView (history grouped by month on the phone). */
export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const confirm = useConfirm();
  const toast = useToast();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    try {
      setSupplier(await mobileApiClient.get<SupplierDetail>(`/api/suppliers/${id}`, 'Failed to load supplier'));
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // load() only sets state after its request settles, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(path: string, title: string, done: string) {
    if (!(await confirm({ title, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await mobileApiClient.delete(path, 'Failed to delete');
      toast(done);
      await load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteSupplier() {
    if (!supplier) return;
    if (!(await confirm({ title: `Delete ${supplier.name}? This cannot be undone.`, tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await mobileApiClient.delete(`/api/suppliers/${supplier.id}`, 'Failed to delete supplier');
      toast(`${supplier.name} deleted`);
      router.back();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  if (!supplier) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        {error ? <FormError message={error} /> : <ActivityIndicator />}
      </View>
    );
  }

  const done = async () => {
    setModal(null);
    await load();
  };

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="gap-5 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-1 self-start" accessibilityRole="link">
          <ChevronLeft size={16} color={colors.slate500} />
          <Text className="text-sm font-medium text-slate-500">All suppliers</Text>
        </Pressable>
        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-card bg-amber-600">
              <Text className="text-lg font-bold text-white">{supplier.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xl font-bold text-ink">{supplier.name}</Text>
              <Text className="text-sm text-slate-500">
                Supplier since {fmtDate(supplier.createdAt)} · {supplier.purchasesCount} purchase{supplier.purchasesCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          {supplier.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${supplier.phone}`)} className="flex-row items-center gap-1.5" accessibilityRole="link">
              <Phone size={14} color={colors.slate500} />
              <Text className="text-sm text-slate-600">{supplier.phone}</Text>
            </Pressable>
          ) : null}
          {supplier.address ? (
            <View className="flex-row items-center gap-1.5">
              <MapPin size={14} color={colors.slate500} />
              <Text className="text-sm text-slate-600">{supplier.address}</Text>
            </View>
          ) : null}
          {supplier.notes ? (
            <View className="flex-row items-center gap-1.5">
              <StickyNote size={14} color={colors.slate500} />
              <Text className="text-sm text-slate-600">{supplier.notes}</Text>
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Button label="Pay supplier" icon={Wallet} variant="amber" onPress={() => setModal({ kind: 'payment', payment: null })} />
            <Button label="New purchase" icon={Plus} onPress={() => setModal({ kind: 'purchase', batch: null })} />
            <Button label="Edit" icon={Edit3} variant="secondary" onPress={() => setModal({ kind: 'supplier' })} />
          </View>
        </Card>

        <StatGrid>
          <StatCard label="Total bought" value={tk(supplier.totalBought)} icon={ShoppingBag} />
          <StatCard label="Total paid" value={tk(supplier.totalPaid)} icon={Wallet} tone="brand" />
          {supplier.advance > 0 ? (
            <StatCard label="Advance paid" value={tk(supplier.advance)} icon={PiggyBank} tone="brand" />
          ) : supplier.totalDue > 0 ? (
            <StatCard label="You still owe" value={tk(supplier.totalDue)} icon={AlertCircle} tone="danger" />
          ) : (
            <StatCard label="You still owe" value={tk(0)} icon={CheckCircle} tone="brand" hint="All settled" />
          )}
        </StatGrid>

        <Card padded={false}>
          <View className="gap-0.5 border-b border-slate-100 px-4 py-3.5">
            <Text className="text-lg font-bold text-ink">History</Text>
            <Text className="text-xs text-slate-500">Payments clear the oldest purchases first.</Text>
          </View>
          {supplier.history.length === 0 ? (
            <Text className="px-4 py-10 text-center text-sm text-slate-500">No purchases or payments yet.</Text>
          ) : (
            groupByMonth(supplier.history).map((g) => (
              <View key={g.month}>
                <Text className="border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{monthLabel(g.month)}</Text>
                {g.entries.map((e) =>
                  e.kind === 'purchase' ? (
                    <PurchaseRow
                      key={`b-${e.purchase.id}`}
                      batch={e.purchase}
                      onEdit={() => setModal({ kind: 'purchase', batch: e.purchase })}
                      onDelete={() =>
                        remove(
                          `/api/feed/${e.purchase.id}`,
                          `Delete the ${e.purchase.name} purchase (${tk(e.purchase.quantity * e.purchase.unitPrice)}) from ${fmtDate(e.purchase.purchasedAt ?? e.purchase.createdAt)}?`,
                          'Purchase deleted',
                        )
                      }
                    />
                  ) : (
                    <View key={`p-${e.payment.id}`} className="flex-row items-start gap-3 border-b border-slate-100 bg-amber-50/40 px-4 py-3">
                      <View className="h-9 w-9 items-center justify-center rounded-control bg-amber-100">
                        <Wallet size={16} color={colors.amber700} />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="text-sm font-semibold text-ink">
                          Paid supplier <Text className="font-normal text-slate-500">· {paymentMethodLabel(e.payment.method)}</Text>
                        </Text>
                        <Text className="text-xs text-slate-500">
                          {fmtDate(e.payment.paidAt)}
                          {e.payment.note ? ` · ${e.payment.note}` : ''}
                        </Text>
                        <Text className="mt-0.5 text-sm font-bold text-amber-800">−{tk(e.payment.amount)}</Text>
                      </View>
                      <IconButton icon={Edit3} label="Edit payment" onPress={() => setModal({ kind: 'payment', payment: e.payment })} />
                      <IconButton
                        icon={Trash2}
                        variant="danger"
                        label="Delete payment"
                        onPress={() =>
                          remove(
                            `/api/supplier-payments/${e.payment.id}`,
                            `Delete the ${tk(e.payment.amount)} payment from ${fmtDate(e.payment.paidAt)}? What you owe will go up by this amount.`,
                            'Payment deleted',
                          )
                        }
                      />
                    </View>
                  ),
                )}
              </View>
            ))
          )}
        </Card>

        {supplier.purchasesCount === 0 ? (
          <Pressable onPress={deleteSupplier} className="flex-row items-center justify-center gap-1.5 py-2" accessibilityRole="button">
            <Trash2 size={14} color={colors.red600} />
            <Text className="text-sm font-semibold text-red-600">Delete supplier</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <PaymentModal
        party={modal?.kind === 'payment' ? supplier : null}
        mode="pay"
        payment={modal?.kind === 'payment' ? modal.payment : null}
        onClose={() => setModal(null)}
        onSaved={async () => {
          toast('Payment saved');
          await done();
        }}
      />
      <FeedPurchaseModal
        open={modal?.kind === 'purchase'}
        batch={modal?.kind === 'purchase' ? modal.batch : null}
        suppliers={[]}
        presetSupplier={{ id: supplier.id, name: supplier.name }}
        onClose={() => setModal(null)}
        onSaved={async () => {
          toast('Purchase saved');
          await done();
        }}
      />
      <SupplierFormModal
        visible={modal?.kind === 'supplier'}
        supplier={supplier}
        onClose={() => setModal(null)}
        onSaved={async () => {
          toast('Supplier saved');
          await done();
        }}
      />
    </View>
  );
}

function PurchaseRow({ batch, onEdit, onDelete }: { batch: FeedBatch; onEdit: () => void; onDelete: () => void }) {
  const total = batch.quantity * batch.unitPrice;
  const paid = batch.paidAmount ?? 0;
  const due = Math.max(0, total - paid);
  const s = batch.schedule;
  return (
    <View className="flex-row items-start gap-3 border-b border-slate-100 px-4 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-control bg-amber-100">
        <Wheat size={16} color={colors.amber700} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-ink">
          Bought {batch.name}
          <Text className="font-normal text-slate-500">
            {' '}
            · {batch.quantity.toLocaleString()} kg × {tk(batch.unitPrice)}
          </Text>
        </Text>
        <StatusPill status={batch.payStatus ?? 'pending'} />
        <Text className="text-xs text-slate-500">
          {fmtDate(batch.purchasedAt ?? batch.createdAt)}
          {s ? ` · ${s.coverDays} day${s.coverDays === 1 ? '' : 's'} · ${s.perDayQty.toLocaleString()} kg/day · ${tk(s.perDayCost)}/day` : ''}
          {due > 0 && paid > 0 ? ` · ${tk(paid)} paid, ${tk(due)} due` : ''}
        </Text>
        <Text className="text-sm font-bold text-ink">{tk(total)}</Text>
      </View>
      <IconButton icon={Edit3} label="Edit purchase" onPress={onEdit} />
      <IconButton icon={Trash2} variant="danger" label="Delete purchase" onPress={onDelete} />
    </View>
  );
}
