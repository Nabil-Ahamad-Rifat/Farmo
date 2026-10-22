// Canonical TypeScript types shared between apps/web and apps/mobile.
// Mirrors the Prisma models (apps/web/prisma/schema.prisma) as seen by
// clients — dates may arrive as serialized strings (JSON) or as Date
// objects (passed directly from a Next.js Server Component), so most date
// fields are typed as `string | Date`.

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Cow {
  id: string;
  /** The Cow ID shown everywhere (e.g. C-001 or an ear-tag number). */
  tagNumber: string;
  name: string;
  breed: string | null;
  purchasePrice: number | null;
  status: string;
  createdAt: Date | string;
  gender?: 'female' | 'male' | string | null;
  category?: 'cow' | 'heifer' | 'calf' | 'bull' | string | null;
  birthDate?: Date | string | null;
  color?: string | null;
  source?: 'born' | 'purchased' | string | null;
  purchaseDate?: Date | string | null;
  notes?: string | null;
  mainPhotoId?: string | null;
  motherId?: string | null;
}

/** Breeding and health status worked out from an animal's records (animalSummary in @farm/business-logic). */
export interface AnimalSummaryInfo {
  lastVaccine: { title: string; date: string } | null;
  dueDoses: { type: string; title: string; dueDate: string }[];
  lastInsemination: { title: string | null; date: string } | null;
  pregnancy: 'pregnant' | 'inseminated' | 'open' | 'unknown';
  expectedCalving: string | null;
  pregnancyCheckDue: string | null;
  lastCalving: string | null;
  latestWeight: { value: number; date: string } | null;
  careCost: number;
}

/** GET /api/cows: each animal with its status and main photo URL (null for animals added before photos). */
export interface CowListItem extends Cow {
  photoUrl: string | null;
  summary: AnimalSummaryInfo;
}

export interface AnimalPhotoInfo {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  size: number;
  caption: string | null;
  takenAt: Date | string;
}

export interface AnimalEvent {
  id: string;
  cowId: string;
  type: 'vaccine' | 'insemination' | 'pregnancy_check' | 'calving' | 'treatment' | 'deworming' | 'weight' | 'other' | string;
  date: Date | string;
  title: string | null;
  nextDueDate: Date | string | null;
  result: string | null;
  value: number | null;
  cost: number | null;
  calfId: string | null;
  notes: string | null;
}

/** GET /api/cows/:id */
export interface AnimalDetail extends CowListItem {
  mother: Pick<Cow, 'id' | 'tagNumber' | 'name'> | null;
  calves: (Pick<Cow, 'id' | 'tagNumber' | 'name' | 'gender' | 'birthDate'> & { photoUrl: string | null })[];
  photos: AnimalPhotoInfo[];
  /** Newest first. */
  events: AnimalEvent[];
}

/** GET /api/animals/due-soon (dueSoon in @farm/business-logic). */
export interface AnimalDueItem {
  cowId: string;
  tagNumber: string;
  name: string;
  kind: 'vaccine' | 'deworming' | 'calving' | 'pregnancy_check';
  title: string;
  dueDate: string;
  daysLeft: number;
}

/** Money given to a worker, or (kind "writeoff") an advance given up as a loss. */
export interface SalaryPayment {
  id: string;
  employeeId?: string;
  kind?: 'payment' | 'writeoff' | string | null;
  amount: number;
  /** Only on payments made before pay accounts. */
  periodMonth?: number | null;
  periodYear?: number | null;
  note: string | null;
  paidAt: string | Date;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  /** Monthly salary (monthly workers). */
  salary: number;
  /** Start day. */
  joinDate: string | Date | null;
  status: 'active' | 'left' | string;
  payType?: 'monthly' | 'daily' | string | null;
  dailyRate?: number | null;
  leftDate?: string | Date | null;
  salaryPayments?: SalaryPayment[];
}

/** workerAccount in @farm/business-logic. Positive balance: the farm owes the worker; negative: an advance. */
export interface WorkerAccountInfo {
  earned: number;
  paid: number;
  writtenOff: number;
  balance: number;
  daysWorked: number;
  daysAbsent: number;
}

/** GET /api/employees */
export interface WorkerListItem extends Employee {
  account: WorkerAccountInfo;
  thisMonth: { earned: number; paid: number; daysAbsent: number };
}

export interface WorkerMonthInfo {
  month: string;
  daysWorked: number;
  daysAbsent: number;
  earned: number;
  paid: number;
  writtenOff: number;
  closing: number;
}

/** GET /api/employees/:id */
export interface WorkerDetail extends Employee {
  account: WorkerAccountInfo;
  /** Newest first. */
  months: WorkerMonthInfo[];
  payments: SalaryPayment[];
  absences: { id: string; date: string | Date; note: string | null }[];
  work: { id: string; date: string | Date; days: number; rate: number; note: string | null }[];
  /** Newest first. */
  rates: { id: string; from: string | Date; monthlySalary: number | null; dailyRate: number | null }[];
  createdAt: string | Date;
}

/** Daily plan for a purchase that lasts a set number of days (see feedSchedule in @farm/business-logic). */
export interface FeedScheduleInfo {
  coverDays: number;
  perDayQty: number;
  perDayCost: number;
  startsOn: string;
  endsOn: string;
  daysUsed: number;
  daysLeft: number;
  remaining: number;
  runsOutOn: string;
}

export interface FeedBatch {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Stock left right now. For scheduled batches the API has already taken off the daily use so far. */
  remainingQuantity: number;
  createdAt: Date | string;
  supplierId?: string | null;
  supplier?: Pick<Supplier, 'id' | 'name'> | null;
  /** How many days this purchase lasts. Unset on older batches (cost then comes from usage records). */
  coverDays?: number | null;
  purchasedAt?: Date | string | null;
  /** Portion of the total covered by payments to the supplier. Derived — never send it. */
  paidAmount?: number | null;
  payStatus?: 'paid' | 'partial' | 'pending' | string | null;
  schedule?: FeedScheduleInfo | null;
}

export interface OtherExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string | Date;
  createdAt: string | Date;
}

export interface OtherIncome {
  id: string;
  description: string;
  amount: number;
  category: string;
  incomeDate: string | Date;
  createdAt: string | Date;
}

export interface Sale {
  id: string;
  customerName: string;
  amount: number;
  status: string;
  saleType: string;
  quantity: number | null;
  unitPrice: number | null;
  notes: string | null;
  cowId: string | null;
  cow?: Pick<Cow, 'id' | 'name' | 'tagNumber'> | null;
  customerId?: string | null;
  customer?: Pick<Customer, 'id' | 'name' | 'type'> | null;
  /** Portion of `amount` covered by the customer's payments (0 for legacy unlinked sales). */
  paidAmount?: number | null;
  createdAt: Date | string;
}

export type CustomerType = 'regular' | 'new';
export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank' | 'other';

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  type: CustomerType | string;
  createdAt: Date | string;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  method: PaymentMethod | string;
  note: string | null;
  paidAt: Date | string;
}

/** A customer plus their running balance, as returned by GET /api/customers. */
export interface CustomerSummary extends Customer {
  totalSold: number;
  totalPaid: number;
  totalDue: number;
  advance: number;
  salesCount: number;
  lastPurchaseAt: Date | string | null;
  /** Price per litre of their most recent milk sale; prefills the sale form. */
  lastMilkPrice?: number | null;
}

export type CustomerHistoryEntry =
  | { kind: 'sale'; date: Date | string; sale: Sale }
  | { kind: 'payment'; date: Date | string; payment: Payment };

/** GET /api/customers/:id */
export interface CustomerDetail extends CustomerSummary {
  sales: Sale[];
  payments: Payment[];
  history: CustomerHistoryEntry[];
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date | string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  method: PaymentMethod | string;
  note: string | null;
  paidAt: Date | string;
}

/** A supplier plus what we owe them, as returned by GET /api/suppliers. */
export interface SupplierSummary extends Supplier {
  totalBought: number;
  totalPaid: number;
  totalDue: number;
  advance: number;
  purchasesCount: number;
  lastPurchaseAt: Date | string | null;
}

export type SupplierHistoryEntry =
  | { kind: 'purchase'; date: Date | string; purchase: FeedBatch }
  | { kind: 'payment'; date: Date | string; payment: SupplierPayment };

/** GET /api/suppliers/:id */
export interface SupplierDetail extends SupplierSummary {
  purchases: FeedBatch[];
  payments: SupplierPayment[];
  history: SupplierHistoryEntry[];
}

export interface PeriodStat {
  days: number;
  totalSales: number;
  totalOtherIncome: number;
  totalRevenue: number;
  salesCount: number;
  totalSalaryCost: number;
  totalFeedCost: number;
  totalOtherCost: number;
  totalCost: number;
  netProfit: number;
}

export interface DailyBreakdown {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface RevenueData {
  periods: PeriodStat[];
  dailyBreakdown: DailyBreakdown[];
  /** Everything customers currently owe, across all time. */
  totalDue?: number;
  /** Everything we currently owe suppliers. */
  totalPayable?: number;
}
