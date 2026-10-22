// Zod validation schemas shared between apps/web (API route validation) and
// apps/mobile (client-side form validation, including while offline, before
// a request ever reaches the network).
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(200),
  tenantName: z.string().trim().max(100).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

// Blank strings from HTML inputs become undefined so optional fields stay optional.
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const money = z.coerce.number().finite().nonnegative().max(1_000_000_000);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const CUSTOMER_TYPES = ['regular', 'new'] as const;
export const PAYMENT_METHODS = ['cash', 'bkash', 'nagad', 'bank', 'other'] as const;
export const SALE_PRODUCT_TYPES = ['milk', 'cow_sale', 'other', 'general', 'products'] as const;

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  phone: optionalText(30),
  address: optionalText(200),
  notes: optionalText(500),
  type: z.enum(CUSTOMER_TYPES).default('new'),
});

export const paymentSchema = z.object({
  amount: money.refine((n) => n > 0, 'Amount must be more than 0'),
  method: z.enum(PAYMENT_METHODS).default('cash'),
  note: optionalText(300),
  paidAt: z.preprocess(blankToUndefined, isoDay.optional()),
});

/**
 * A sale from the web or mobile app. Either `customerId` or `customerName`
 * identifies the buyer (mobile only sends the name). `paidNow` is what was
 * collected at the time of sale; older clients send `status` instead.
 */
export const saleSchema = z
  .object({
    customerId: z.preprocess(blankToUndefined, z.string().trim().max(50).optional()),
    customerName: optionalText(100),
    customerType: z.enum(CUSTOMER_TYPES).optional(),
    amount: money,
    saleType: z.preprocess(blankToUndefined, z.enum(SALE_PRODUCT_TYPES).default('other')),
    quantity: z.preprocess(blankToUndefined, money.optional()),
    unitPrice: z.preprocess(blankToUndefined, money.optional()),
    notes: optionalText(500),
    cowId: z.preprocess(blankToUndefined, z.string().trim().max(50).optional()),
    saleDate: z.preprocess(blankToUndefined, isoDay.optional()),
    paidNow: z.preprocess(blankToUndefined, money.optional()),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    status: z.preprocess(blankToUndefined, z.enum(['paid', 'pending', 'partial']).optional()),
  })
  .refine((s) => s.customerId || s.customerName, { message: 'Customer is required', path: ['customerName'] })
  .refine((s) => s.paidNow === undefined || s.paidNow <= s.amount, {
    message: 'Paid now cannot be more than the sale amount',
    path: ['paidNow'],
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  phone: optionalText(30),
  address: optionalText(200),
  notes: optionalText(500),
});

/**
 * A feed purchase from the web or mobile app. Older mobile builds send only
 * name/quantity/unitPrice/remainingQuantity: that is a fully paid batch with
 * no schedule. `paidNow` below the total (partly paid or baki) needs a
 * supplier, given as `supplierId` or a `supplierName` to find or create.
 */
export const feedPurchaseSchema = z
  .object({
    name: z.string().trim().min(1, 'Feed name is required').max(100),
    quantity: money.refine((n) => n > 0, 'Quantity must be more than 0'),
    unitPrice: money,
    remainingQuantity: z.preprocess(blankToUndefined, money.optional()),
    supplierId: z.preprocess(blankToUndefined, z.string().trim().max(50).optional()),
    supplierName: optionalText(100),
    coverDays: z.preprocess(
      (v) => (v === null ? undefined : blankToUndefined(v)),
      z.coerce.number().int('Days must be a whole number').min(1, 'At least 1 day').max(366).optional(),
    ),
    purchasedAt: z.preprocess(blankToUndefined, isoDay.optional()),
    paidNow: z.preprocess(blankToUndefined, money.optional()),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  })
  .refine((f) => f.remainingQuantity === undefined || f.remainingQuantity <= f.quantity, {
    message: 'Remaining cannot be more than the quantity bought',
    path: ['remainingQuantity'],
  })
  .refine((f) => f.paidNow === undefined || f.paidNow <= Math.round(f.quantity * f.unitPrice * 100) / 100, {
    message: 'Paid now cannot be more than the total',
    path: ['paidNow'],
  })
  .refine(
    (f) =>
      f.paidNow === undefined ||
      f.paidNow >= Math.round(f.quantity * f.unitPrice * 100) / 100 ||
      f.supplierId ||
      f.supplierName,
    { message: 'Choose the supplier you owe for a partly paid or baki purchase', path: ['supplierName'] },
  );

/** Farm-wide preferences edited on the Settings page. */
export const farmSettingsSchema = z.object({
  defaultMilkPrice: money.refine((n) => n > 0, 'Price must be more than 0'),
});

export const ANIMAL_STATUSES = ['active', 'sold', 'dead'] as const;
export const ANIMAL_GENDERS = ['female', 'male'] as const;
export const ANIMAL_CATEGORIES = ['cow', 'heifer', 'calf', 'bull'] as const;
export const ANIMAL_SOURCES = ['born', 'purchased'] as const;
export const ANIMAL_EVENT_KINDS = [
  'vaccine',
  'insemination',
  'pregnancy_check',
  'calving',
  'treatment',
  'deworming',
  'weight',
  'other',
] as const;

/** Base64 of a JPEG/PNG/WebP photo, already resized by the client. 600 KB decoded at most. */
export const animalPhotoSchema = z.object({
  data: z
    .string()
    .min(100, 'Photo is empty')
    .max(820_000, 'Photo is too large; please use a smaller picture')
    .regex(/^[A-Za-z0-9+/=\s]+$/, 'Photo data is not valid'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  width: z.coerce.number().int().positive().max(10000).optional(),
  height: z.coerce.number().int().positive().max(10000).optional(),
  caption: optionalText(200),
});

const optionalId = z.preprocess(blankToUndefined, z.string().trim().max(50).optional());
const optionalDay = z.preprocess(blankToUndefined, isoDay.optional());

/**
 * An animal from the web or mobile form. `tagNumber` is the Cow ID. The
 * photo is required when adding an animal; the route checks that, since the
 * same schema is used for edits (where photos are managed separately).
 */
export const animalSchema = z.object({
  tagNumber: z.string().trim().min(1, 'Cow ID is required').max(30),
  name: optionalText(100),
  breed: optionalText(100),
  color: optionalText(50),
  gender: z.preprocess(blankToUndefined, z.enum(ANIMAL_GENDERS).default('female')),
  category: z.preprocess(blankToUndefined, z.enum(ANIMAL_CATEGORIES).optional()),
  birthDate: optionalDay,
  source: z.preprocess(blankToUndefined, z.enum(ANIMAL_SOURCES).optional()),
  purchaseDate: optionalDay,
  purchasePrice: z.preprocess(blankToUndefined, money.optional()),
  motherId: optionalId,
  status: z.preprocess(blankToUndefined, z.enum(ANIMAL_STATUSES).default('active')),
  notes: optionalText(1000),
  photo: animalPhotoSchema.optional(),
});

/**
 * One history record. Required details depend on the type: a vaccine needs
 * its name, a pregnancy check its result, a weight its value. A calving can
 * add the calf as a new animal at the same time.
 */
export const animalEventSchema = z
  .object({
    type: z.enum(ANIMAL_EVENT_KINDS),
    date: isoDay,
    title: optionalText(150),
    nextDueDate: optionalDay,
    result: z.preprocess(blankToUndefined, z.enum(['positive', 'negative']).optional()),
    value: z.preprocess(blankToUndefined, z.coerce.number().finite().positive().max(5000).optional()),
    cost: z.preprocess(blankToUndefined, money.optional()),
    notes: optionalText(1000),
    createCalf: z
      .object({
        tagNumber: z.string().trim().min(1, 'Calf ID is required').max(30),
        name: optionalText(100),
        gender: z.enum(ANIMAL_GENDERS).default('female'),
        photo: animalPhotoSchema,
      })
      .optional(),
  })
  .refine((e) => e.type !== 'vaccine' || e.title, { message: 'Enter the vaccine name', path: ['title'] })
  .refine((e) => e.type !== 'pregnancy_check' || e.result, { message: 'Choose the check result', path: ['result'] })
  .refine((e) => e.type !== 'weight' || e.value !== undefined, { message: 'Enter the weight', path: ['value'] })
  .refine((e) => !e.nextDueDate || e.nextDueDate >= e.date, { message: 'Next due date must be after the record date', path: ['nextDueDate'] })
  .refine((e) => !e.createCalf || e.type === 'calving', { message: 'A calf can only be added with a calving', path: ['createCalf'] });

export const PAY_TYPES = ['monthly', 'daily'] as const;

/**
 * A worker from the web or mobile form. Monthly workers need their monthly
 * salary, daily workers their day rate; both need the day they started.
 * `rateFrom` is the day a changed salary/rate applies from (edits only;
 * defaults to today).
 */
export const employeeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    role: z.preprocess(blankToUndefined, z.string().trim().max(100).default('Worker')),
    phone: optionalText(30),
    email: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().email('Enter a valid email').max(255).optional()),
    payType: z.preprocess(blankToUndefined, z.enum(PAY_TYPES).default('monthly')),
    salary: z.preprocess(blankToUndefined, money.optional()),
    dailyRate: z.preprocess(blankToUndefined, money.optional()),
    joinDate: isoDay,
    rateFrom: optionalDay,
  })
  .refine((e) => e.payType !== 'monthly' || (e.salary ?? 0) > 0, { message: 'Enter the monthly salary', path: ['salary'] })
  .refine((e) => e.payType !== 'daily' || (e.dailyRate ?? 0) > 0, { message: 'Enter the day rate', path: ['dailyRate'] });

/** Money given to a worker: any amount, any day (an advance or wages). */
export const workerPaymentSchema = z.object({
  amount: money.refine((n) => n > 0, 'Amount must be more than 0'),
  paidAt: optionalDay,
  note: optionalText(300),
});

/** Days a monthly worker was absent: one day, or `from` to `to`. */
export const absenceSchema = z
  .object({
    from: isoDay,
    to: optionalDay,
    note: optionalText(200),
  })
  .refine((a) => !a.to || a.to >= a.from, { message: 'The last day must be on or after the first day', path: ['to'] })
  .refine((a) => !a.to || Date.parse(a.to) - Date.parse(a.from) <= 366 * 86_400_000, { message: 'Mark at most one year at a time', path: ['to'] });

/** Work done by a daily worker. `rate` defaults to the worker's current day rate. */
export const workEntrySchema = z.object({
  date: isoDay,
  days: z.coerce
    .number()
    .finite()
    .positive('Days must be more than 0')
    .max(31, 'At most 31 days in one entry')
    .refine((n) => Number.isInteger(n * 2), 'Use whole or half days'),
  rate: z.preprocess(blankToUndefined, money.refine((n) => n > 0, 'Rate must be more than 0').optional()),
  note: optionalText(200),
});

/** The day a worker left. Blank means they came back (still working). */
export const leaveSchema = z.object({
  leftDate: optionalDay,
});

/** A manager the owner adds: their login email and a password the owner gives them. */
export const teamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

/** Change a manager's name or set a new password (which logs them out everywhere). */
export const teamMemberUpdateSchema = z.object({
  name: z.preprocess(blankToUndefined, z.string().trim().min(1).max(100).optional()),
  password: z.preprocess(blankToUndefined, z.string().min(8, 'Password must be at least 8 characters').max(200).optional()),
});

/** A MongoDB ObjectId as text (24 hex characters). */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Not a valid id');

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1).max(200),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

/** Sign out: mobile sends its refresh token so it is revoked too. */
export const logoutSchema = z.object({
  refreshToken: z.string().max(200).optional(),
});

/** Create a new ranch (farm) and move the signed-in owner to it. */
export const ranchSchema = z.object({
  ranchName: z.string().trim().min(1, 'Ranch name is required').max(100),
});

// Amount on an edit: blank or missing keeps the old one.
const blankOrNullToUndefined = (v: unknown) => (v === null ? undefined : blankToUndefined(v));
const positiveAmount = money.refine((n) => n > 0, 'Amount must be a positive number');
// Dates go on to entryDay() in the API, which checks the format and the future.
const entryDate = z.preprocess(blankOrNullToUndefined, z.string().max(40).optional());

/** Other income. Same body for create and (all fields optional) edit. */
export const incomeSchema = z.object({
  description: z.string().trim().min(1, 'Description and amount are required').max(200),
  amount: z.preprocess(blankOrNullToUndefined, positiveAmount),
  category: optionalText(50),
  incomeDate: entryDate,
});
export const incomeUpdateSchema = z.object({
  description: optionalText(200),
  amount: z.preprocess(blankOrNullToUndefined, positiveAmount.optional()),
  category: optionalText(50),
  incomeDate: entryDate,
});

/** Other expense. Same body for create and (all fields optional) edit. */
export const expenseSchema = z.object({
  description: z.string().trim().min(1, 'Description and a valid positive amount are required').max(200),
  amount: z.preprocess(blankOrNullToUndefined, positiveAmount),
  category: optionalText(50),
  expenseDate: entryDate,
});
export const expenseUpdateSchema = z.object({
  description: optionalText(200),
  amount: z.preprocess(blankOrNullToUndefined, positiveAmount.optional()),
  category: optionalText(50),
  expenseDate: entryDate,
});

/** Feed taken out of a batch by hand. */
export const feedUsageSchema = z.object({
  feedBatchId: objectIdSchema,
  quantity: z.preprocess(blankOrNullToUndefined, money.refine((n) => n > 0, 'A valid usage quantity greater than zero is required')),
  note: optionalText(300),
  usedAt: z.preprocess(
    blankOrNullToUndefined,
    z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date').optional(),
  ),
});
