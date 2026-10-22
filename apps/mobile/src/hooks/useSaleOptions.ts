import { useCallback, useEffect, useState } from 'react';
import type { Cow, CustomerSummary } from '@farm/shared-types';
import { mobileApiClient } from '@/src/lib/apiClient';

/** Customers (with dues and last milk price), the default milk price and active cows for the sale form. */
export function useSaleOptions() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [activeCows, setActiveCows] = useState<Cow[]>([]);
  const [defaultMilkPrice, setDefaultMilkPrice] = useState(70);

  const reload = useCallback(async () => {
    // Each part is optional for the form, so one failing doesn't block the others.
    await Promise.all([
      mobileApiClient.get<CustomerSummary[]>('/api/customers').then(setCustomers).catch(() => {}),
      mobileApiClient.get<{ defaultMilkPrice: number }>('/api/settings').then((s) => setDefaultMilkPrice(s.defaultMilkPrice)).catch(() => {}),
      mobileApiClient.get<Cow[]>('/api/cows').then((cows) => setActiveCows(cows.filter((c) => c.status === 'active'))).catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { customers, activeCows, defaultMilkPrice, reload };
}
