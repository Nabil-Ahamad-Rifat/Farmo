import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  HandCoins, Plus, ShoppingBag, Wallet, AlertCircle, PiggyBank, CheckCircle, Phone, MapPin, StickyNote, Edit3, Trash2, ChevronLeft,
} from 'lucide-react-native';
import type { CustomerDetail, Payment, Sale } from '@farm/shared-types';
import { customerMonths } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { useSaleOptions } from '@/src/hooks/useSaleOptions';
import { tk, fmtDate, paymentMethodLabel } from '@/src/lib/format';
import { Button, Card, FormError, StatCard, StatGrid, useConfirm, useToast } from '@/src/components/ui';
import { StatusPill, TypeBadge } from '@/src/components/StatusPill';
import { PaymentModal } from '@/src/components/PaymentModal';
import { SaleFormModal } from '@/src/components/SaleFormModal';
import { CustomerFormModal } from '@/src/components/CustomerFormModal';
import { groupByMonth, MonthHeading } from '@/src/components/MonthSection';
import { cardShadow, colors } from '@/src/theme';

const PRODUCTS: Record<string, { label: string; unit: string }> = {
  milk: { label: 'Milk', unit: 'L' },
  cow_sale: { label: 'Cow', unit: 'head' },
  other: { label: 'Other', unit: '' },
};

/** Paid part of a sale (derived for customer sales). */
const salePaid = (s: Sale) => (s.customerId ? s.paidAmount ?? 0 : s.status === 'paid' ? s.amount : 0);

type ModalState = { kind: 'sale'; sale: Sale | null } | { kind: 'payment'; payment: Payment | null } | { kind: 'customer' } | null;

/** A customer's page, like the web's CustomerDetailView. */
export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const options = useSaleOptions();
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setCustomer(await mobileApiClient.get<CustomerDetail>(`/api/customers/${id}`, 'Failed to load customer'));
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

  const months = useMemo(
    () =>
      customer
        ? customerMonths(
            customer.sales.map((s) => ({ partyId: customer.id, amount: s.amount, date: s.createdAt, saleType: s.saleType, quantity: s.quantity })),
            customer.payments.map((p) => ({ partyId: customer.id, amount: p.amount, date: p.paidAt })),
          )
        : [],
    [customer],
  );

  const done = () => {
    setModal(null);
    load();
  };

  async function deleteSale(sale: Sale) {
    if (!(await confirm({ title: `Delete the ${tk(sale.amount)} sale from ${fmtDate(sale.createdAt)}?`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await mobileApiClient.delete(`/api/sales/${sale.id}`, 'Failed to delete sale.');
      toast('Sale deleted');
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deletePayment(p: Payment) {
    const title = `Delete the ${tk(p.amount)} payment from ${fmtDate(p.paidAt)}? Their due will go up by this amount.`;
    if (!(await confirm({ title, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await mobileApiClient.delete(`/api/payments/${p.id}`, 'Failed to delete payment.');
      toast('Payment deleted');
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteCustomer() {
    if (!customer) return;
    if (!(await confirm({ title: `Delete ${customer.name}? This cannot be undone.`, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await mobileApiClient.delete(`/api/customers/${customer.id}`, 'Failed to delete customer');
      toast(`${customer.name} deleted`);
      router.back();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  if (!customer) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        {error ? <FormError message={error} /> : <ActivityIndicator />}
      </View>
    );
  }

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
          <Text className="text-sm font-semibold text-slate-500">All customers</Text>
        </Pressable>
        <FormError message={error} />

        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-card bg-ink">
              <Text className="text-lg font-bold text-white">{customer.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="shrink text-xl font-bold text-ink">{customer.name}</Text>
                <TypeBadge type={customer.type} />
              </View>
              <Text className="text-sm text-slate-500">
                Customer since {fmtDate(customer.createdAt)} · {customer.salesCount} sale{customer.salesCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          {customer.phone || customer.address || customer.notes ? (
            <View className="gap-1.5">
              {customer.phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${customer.phone}`)} className="flex-row items-center gap-1.5 self-start" accessibilityRole="link">
                  <Phone size={16} color={colors.slate600} />
                  <Text className="text-sm font-medium text-brand-700">{customer.phone}</Text>
                </Pressable>
              ) : null}
              {customer.address ? (
                <View className="flex-row items-center gap-1.5">
                  <MapPin size={16} color={colors.slate600} />
                  <Text className="flex-1 text-sm text-slate-600">{customer.address}</Text>
                </View>
              ) : null}
              {customer.notes ? (
                <View className="flex-row items-center gap-1.5">
                  <StickyNote size={16} color={colors.slate600} />
                  <Text className="flex-1 text-sm text-slate-600">{customer.notes}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            <Button label="Collect payment" icon={HandCoins} variant="brand" onPress={() => setModal({ kind: 'payment', payment: null })} />
            <Button label="New sale" icon={Plus} onPress={() => setModal({ kind: 'sale', sale: null })} />
            <Button label="Edit" icon={Edit3} variant="secondary" onPress={() => setModal({ kind: 'customer' })} />
          </View>
        </Card>

        <StatGrid>
          <StatCard label="Total bought" value={tk(customer.totalSold)} icon={ShoppingBag} />
          <StatCard label="Total paid" value={tk(customer.totalPaid)} icon={Wallet} tone="brand" />
          {customer.advance > 0 ? (
            <StatCard label="Advance (credit)" value={tk(customer.advance)} icon={PiggyBank} tone="brand" />
          ) : customer.totalDue > 0 ? (
            <StatCard label="Still due" value={tk(customer.totalDue)} icon={AlertCircle} tone="danger" />
          ) : (
            <StatCard label="Still due" value={tk(0)} icon={CheckCircle} tone="brand" hint="All settled" />
          )}
        </StatGrid>

        <View style={cardShadow} className="overflow-hidden rounded-card border border-line bg-white">
          <View className="gap-0.5 border-b border-slate-100 px-4 py-3.5">
            <Text className="text-lg font-bold text-ink">History</Text>
            <Text className="text-xs text-slate-500">Payments clear the oldest sales first.</Text>
          </View>
          {customer.history.length === 0 ? (
            <Text className="px-4 py-12 text-center text-sm text-slate-500">No sales or payments yet.</Text>
          ) : (
            groupByMonth(customer.history).map(({ month, entries }) => (
              <View key={month}>
                <MonthHeading month={month} summary={months.find((m) => m.month === month)} />
                {entries.map((e, i) =>
                  e.kind === 'sale' ? (
                    <SaleRow key={`s-${e.sale.id}`} sale={e.sale} first={i === 0} onEdit={() => setModal({ kind: 'sale', sale: e.sale })} onDelete={() => deleteSale(e.sale)} />
                  ) : (
                    <PaymentRow
                      key={`p-${e.payment.id}`}
                      payment={e.payment}
                      first={i === 0}
                      onEdit={() => setModal({ kind: 'payment', payment: e.payment })}
                      onDelete={() => deletePayment(e.payment)}
                    />
                  ),
                )}
              </View>
            ))
          )}
        </View>

        {customer.salesCount === 0 ? (
          <Pressable onPress={deleteCustomer} className="self-end py-2" accessibilityRole="button">
            <Text className="text-sm font-semibold text-red-600">Delete customer</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <PaymentModal
        party={modal?.kind === 'payment' ? customer : null}
        mode="collect"
        payment={modal?.kind === 'payment' ? modal.payment : null}
        onClose={() => setModal(null)}
        onSaved={done}
      />
      <SaleFormModal
        open={modal?.kind === 'sale'}
        sale={modal?.kind === 'sale' ? modal.sale : null}
        customers={[]}
        activeCows={options.activeCows}
        defaultMilkPrice={options.defaultMilkPrice}
        presetCustomer={{ id: customer.id, name: customer.name, type: customer.type, lastMilkPrice: customer.lastMilkPrice }}
        onClose={() => setModal(null)}
        onSaved={done}
      />
      <CustomerFormModal visible={modal?.kind === 'customer'} customer={customer} onClose={() => setModal(null)} onSaved={done} />
    </View>
  );
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className="flex-row">
      <Pressable onPress={onEdit} className="rounded-lg p-2" accessibilityLabel={`Edit ${label}`}>
        <Edit3 size={16} color={colors.slate400} />
      </Pressable>
      <Pressable onPress={onDelete} className="rounded-lg p-2" accessibilityLabel={`Delete ${label}`}>
        <Trash2 size={16} color={colors.slate400} />
      </Pressable>
    </View>
  );
}

function SaleRow({ sale, first, onEdit, onDelete }: { sale: Sale; first: boolean; onEdit: () => void; onDelete: () => void }) {
  const info = PRODUCTS[sale.saleType] ?? { label: 'Other', unit: '' };
  const paid = salePaid(sale);
  const due = Math.max(0, sale.amount - paid);
  return (
    <View className={`flex-row items-start gap-3 px-4 py-3.5 ${first ? '' : 'border-t border-slate-100'}`}>
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-control bg-slate-100">
        <ShoppingBag size={16} color={colors.slate600} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="shrink text-sm font-semibold text-ink">
            Sold {info.label.toLowerCase()}
            {sale.quantity != null && sale.unitPrice != null ? (
              <Text className="font-normal text-slate-500">
                {' '}· {sale.quantity}
                {info.unit ? ` ${info.unit}` : ''} × {tk(sale.unitPrice)}
              </Text>
            ) : null}
            {sale.cow ? <Text className="font-normal text-slate-500"> · {sale.cow.name} ({sale.cow.tagNumber})</Text> : null}
          </Text>
          <StatusPill status={sale.status} />
        </View>
        <Text className="mt-0.5 text-xs text-slate-500">
          {fmtDate(sale.createdAt)}
          {sale.notes ? ` · ${sale.notes}` : ''}
          {due > 0 && paid > 0 ? ` · ${tk(paid)} paid, ${tk(due)} due` : ''}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-bold text-ink">{tk(sale.amount)}</Text>
        <RowActions label={`sale of ${tk(sale.amount)}`} onEdit={onEdit} onDelete={onDelete} />
      </View>
    </View>
  );
}

function PaymentRow({ payment, first, onEdit, onDelete }: { payment: Payment; first: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <View className={`flex-row items-start gap-3 bg-brand-50/40 px-4 py-3.5 ${first ? '' : 'border-t border-slate-100'}`}>
      <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-control bg-brand-100">
        <HandCoins size={16} color={colors.brand600} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-ink">
          Received payment <Text className="font-normal text-slate-500">· {paymentMethodLabel(payment.method)}</Text>
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">
          {fmtDate(payment.paidAt)}
          {payment.note ? ` · ${payment.note}` : ''}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-bold text-brand-700">+{tk(payment.amount)}</Text>
        <RowActions label={`payment of ${tk(payment.amount)}`} onEdit={onEdit} onDelete={onDelete} />
      </View>
    </View>
  );
}
