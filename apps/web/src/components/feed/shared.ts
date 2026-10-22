import type { FeedBatch } from '@farm/shared-types';

/** Paid/partial/due for a batch: derived for supplier purchases; older and supplier-less ones are paid. */
export const feedPayStatus = (b: Pick<FeedBatch, 'supplierId' | 'payStatus'>) =>
  b.supplierId ? b.payStatus ?? 'pending' : 'paid';
