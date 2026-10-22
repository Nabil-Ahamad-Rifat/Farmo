import { View, Pressable, ScrollView, Linking } from 'react-native';
import { router, type Href } from 'expo-router';
import {
  Home, PawPrint, Wheat, Users, DollarSign, HandCoins, Coins, Store, PackageOpen, TrendingUp, History, CalendarRange,
  UserCog, Settings, FileText, Trash2, LogOut, ChevronRight, type LucideIcon,
} from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { API_URL } from '@/src/lib/apiClient';
import { useSession } from '@/src/context/AuthContext';
import { useConfirm } from '@/src/components/ui';
import { cardShadow, colors } from '@/src/theme';

interface Item {
  href: Href;
  label: string;
  icon: LucideIcon;
}

// The web app's menu (components/DashboardShell.tsx GROUPS), in the same order.
const GROUPS: { title: string; ownerOnly?: boolean; items: Item[] }[] = [
  {
    title: 'Farm',
    items: [
      { href: '/', label: 'Overview', icon: Home },
      { href: '/cows', label: 'Animals', icon: PawPrint },
      { href: '/more/feed', label: 'Feed', icon: Wheat },
      { href: '/more/employees', label: 'Workers', icon: Users },
    ],
  },
  {
    title: 'Selling',
    items: [
      { href: '/sales', label: 'Sales', icon: DollarSign },
      { href: '/dues', label: 'Customers & Dues', icon: HandCoins },
      { href: '/more/income', label: 'Other Income', icon: Coins },
    ],
  },
  {
    title: 'Spending',
    items: [
      { href: '/more/suppliers', label: 'Suppliers & Payables', icon: Store },
      { href: '/more/expenses', label: 'Other Expenses', icon: PackageOpen },
    ],
  },
  {
    title: 'Reports',
    ownerOnly: true,
    items: [
      { href: '/more/revenue', label: 'Revenue Portal', icon: TrendingUp },
      { href: '/more/history', label: 'History', icon: History },
      { href: '/more/report', label: 'Monthly Report', icon: CalendarRange },
      { href: '/more/team', label: 'Team', icon: UserCog },
      { href: '/more/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function MoreScreen() {
  const { user, isOwner, signOut } = useSession();
  const confirm = useConfirm();

  async function handleSignOut() {
    if (await confirm({ title: 'Sign out?', message: 'You can sign in again with your email and password.', confirmLabel: 'Sign out' })) {
      signOut();
    }
  }

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="gap-5 p-4 pb-10">
      {GROUPS.filter((g) => isOwner || !g.ownerOnly).map((group) => (
        <View key={group.title} className="gap-2">
          <Text className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</Text>
          <View style={cardShadow} className="overflow-hidden rounded-card border border-line bg-white">
            {group.items.map(({ href, label, icon: Icon }, i) => (
              <MenuRow key={label} label={label} icon={Icon} first={i === 0} onPress={() => router.navigate(href)} />
            ))}
          </View>
        </View>
      ))}

      <View style={cardShadow} className="overflow-hidden rounded-card border border-line bg-white">
        <MenuRow label="Privacy Policy" icon={FileText} first onPress={() => Linking.openURL(`${API_URL}/privacy`)} />
        {/* Owners delete their account from Settings, like the web; managers have no Settings. */}
        {!isOwner ? <MenuRow label="Delete my login" icon={Trash2} danger onPress={() => router.push('/more/delete-account')} /> : null}
      </View>

      {/* Signed-in person and sign out, like the bottom of the web menu. */}
      <View style={cardShadow} className="flex-row items-center gap-3 rounded-card border border-line bg-white p-4">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-ink">
          <Text className="text-base font-bold text-white">{(user?.name ?? '?').trim().charAt(0).toUpperCase()}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {user?.name}
          </Text>
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            {user?.email}
            {isOwner ? '' : ' · Manager'}
          </Text>
        </View>
        <Pressable onPress={handleSignOut} accessibilityRole="button" className="flex-row items-center gap-1.5 rounded-control border border-line px-3 py-2">
          <LogOut size={14} color={colors.slate600} />
          <Text className="text-xs font-semibold text-slate-700">Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MenuRow({ label, icon: Icon, onPress, first, danger }: { label: string; icon: LucideIcon; onPress: () => void; first?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className={`flex-row items-center justify-between px-4 py-3.5 ${first ? '' : 'border-t border-slate-100'}`}
    >
      <View className="flex-row items-center gap-3">
        <View className={`h-9 w-9 items-center justify-center rounded-control ${danger ? 'bg-red-50' : 'bg-slate-100'}`}>
          <Icon size={16} color={danger ? colors.red600 : colors.slate600} />
        </View>
        <Text className={`text-[15px] font-semibold ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</Text>
      </View>
      <ChevronRight size={16} color={colors.slate400} />
    </Pressable>
  );
}
