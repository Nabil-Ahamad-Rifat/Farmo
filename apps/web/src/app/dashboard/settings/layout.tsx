import { requireOwnerPage } from '@/lib/auth/session';

// Settings and the team are for the farm owner only.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return children;
}
