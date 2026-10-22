import { Badge } from '@/src/components/ui';
import { balanceInfo } from './shared';

/** "You owe ৳X" (red), "Advance ৳X" (amber) or "Settled" (green), like the web's BalancePill. */
export function BalancePill({ balance }: { balance: number }) {
  const b = balanceInfo(balance);
  return <Badge label={b.label} tone={b.tone} />;
}

/** Working / Left, like the web's WorkerStatusBadge. */
export function WorkerStatusBadge({ status }: { status: string }) {
  return status === 'left' ? <Badge label="Left" tone="neutral" /> : <Badge label="Working" tone="brand" />;
}
