# Default Milk Price + Monthly Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefill the milk price per customer (their last milk price, or a tenant default of ৳70), group each customer's history by month, and add a live monthly close report.

**Architecture:**
- One pure function, `monthlyStatement()`, in `@farm/business-logic` does all month math. It is unit-tested.
- `apps/web/src/lib/monthly-report.ts` loads sales and payments and calls it, for both the report page and the customer page.
- The default price is a nullable `Tenant.defaultMilkPrice`, read and written through `/api/settings`.

**Tech Stack:**
- Next.js 16.3 App Router: `params` and `searchParams` are Promises.
- Prisma on MongoDB, zod 4, vitest, Tailwind, lucide-react.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-10-06-milk-price-monthly-report-design.md`
- Milk unit stays **L**. The fallback default price is **৳70**.
- Months are UTC calendar months.
  - Paid in month = `paidAt` falls in the month.
  - Carried in = sales before the month − payments before it.
  - Month end = carried in + sold − paid.
  - Farm due = sum of positive month-end balances.
- Legacy customer-less sales are one "No customer" line. A sale marked `paid` counts as paid on its own sale date.
- Mobile app unchanged. Verify only against the local DB (`mongodb://127.0.0.1:27018/farm-local?replicaSet=rs0`), never Atlas.
- Don't commit unless the owner asks (repo rule for this session).

---

### Task 1: `monthlyStatement` + `monthKey` (pure, TDD)

**Files:**
- Modify: `packages/business-logic/src/index.ts` (append)
- Test: `packages/business-logic/src/index.test.ts` (append)

**Interfaces:**
- Produces:
  - `monthKey(d: Date | string): string`: "YYYY-MM", UTC.
  - `monthBounds(month: string): { start: Date; end: Date }`: inclusive, UTC.
  - `shiftMonth(month: string, delta: number): string`
  - `monthlyStatement(sales: StatementSale[], payments: StatementPayment[], month: string): MonthStatement`
  - `customerMonths(sales, payments): MonthSummary[]`: newest first, one entry for each month with activity.
- Types:
  - `StatementSale { partyId: string | null; amount: number; date: Date | string; saleType: string; quantity?: number | null; status?: string | null }`
  - `StatementPayment { partyId: string; amount: number; date: Date | string }`
  - `MonthLine { partyId: string | null; milkLitres; sold; paid; carriedIn; closing; salesCount; paymentsCount }`
  - `MonthStatement { month; lines: MonthLine[]; totals: { milkLitres; sold; collected; carriedIn; dueAtEnd; advanceAtEnd } }`
  - `MonthSummary { month; milkLitres; sold; paid; closing }`

- [ ] Step 1: Write the failing tests:
  - carry-over from an earlier month
  - advance carried in
  - a payment in a later month
  - legacy paid and unpaid sales
  - milk litres counted only for milk
  - lines with no activity and a zero balance dropped
  - totals: an advance doesn't offset another customer's due
  - `customerMonths` running closing
  - `shiftMonth` across a year boundary
- [ ] Step 2: Run `npx vitest run` in `packages/business-logic`. Expect FAIL (not exported).
- [ ] Step 3: Implement. Legacy sales with `status === 'paid'` become synthetic payments with partyId null. Accumulate per party in paisa, then sort lines by closing desc.
- [ ] Step 4: Run the tests. Expect PASS.

### Task 2: Default milk price setting

**Files:**
- Modify:
  - `apps/web/prisma/schema.prisma`: `Tenant.defaultMilkPrice Float?`
  - `packages/shared-validation/src/index.ts` and its test: `farmSettingsSchema = z.object({ defaultMilkPrice: money.refine(n => n > 0) })`
  - `apps/web/src/app/dashboard/settings/page.tsx`: a "Sales defaults" card above the delete card
- Create:
  - `apps/web/src/app/api/settings/route.ts`: GET returns `{ defaultMilkPrice }` (null → 70); PUT validates and saves it.
  - `apps/web/src/lib/settings.ts`: `DEFAULT_MILK_PRICE = 70`, `getDefaultMilkPrice(tenantId)`

- [ ] Steps:
  1. Schema, then `prisma generate`.
  2. Validation and its tests.
  3. Route and lib.
  4. Settings card that fetches GET on mount and saves with PUT.
  5. Typecheck.

### Task 3: Prefill price in the sale form

**Files:**
- Modify:
  - `apps/web/src/lib/receivables.ts`: `lastMilkPrices(tenantId, ids)`, merged as `lastMilkPrice` into `listCustomersWithBalances` and `getCustomerDetail`
  - `packages/shared-types/src/index.ts`: `CustomerSummary.lastMilkPrice?: number | null`
  - `components/sales/CustomerPicker.tsx`: `PickerCustomer.lastMilkPrice?`
  - `components/sales/SaleFormModal.tsx`: new prop `defaultMilkPrice: number`, plus `priceTouched` state
  - Callers: `SalesManager.tsx` and `sales/page.tsx`; `CustomerDetailView.tsx` and `customers/[id]/page.tsx`
- Rule:
  - New sale and milk and price not typed by the user: price = chosen customer's `lastMilkPrice ?? defaultMilkPrice`, or `defaultMilkPrice` before any customer is chosen.
  - Typing in the price sets `priceTouched`.
  - Editing an existing sale never prefills.

### Task 4: Monthly report page + customer history by month

**Files:**
- Create:
  - `apps/web/src/lib/monthly-report.ts`:
    - `getMonthlyReport(tenantId, month)` → `{ statement, customers: Map }`
    - `getCustomerMonths(tenantId, customerId)` → `MonthSummary[]`
  - `apps/web/src/app/dashboard/reports/page.tsx`: reads `searchParams.month`, falling back to the current month on bad input.
  - `apps/web/src/components/MonthlyReport.tsx`: month picker links, five summary cards, customer table with a Collect button and a "No customer" row.
- Modify:
  - `CustomerDetailView.tsx`: group history by `monthKey`, with month headings `id="m-YYYY-MM"` showing L, sold, paid and due at month end.
  - `customers/[id]/page.tsx`: pass `months`.
  - `dashboard/layout.tsx`: nav item "Monthly Report".
  - `packages/shared-types`: `MonthSummary` re-export not needed. Use the business-logic types directly.

### Task 5: Verify
- `npx turbo run typecheck lint test`
- Run `prisma db push` on the local DB using the googleId index workaround (see memory).
- API smoke test, on a fresh tenant:
  - set the default price to 75, then check GET
  - check the customer list `lastMilkPrice`
  - check the report numbers across two months: September sale 1000 with 400 paid, October sale 500, October payment 300. Expect Oct carried 600 → closing 800, and Sep closing 600.
  - check that a legacy sale shows in the "No customer" row
- Headless Chrome:
  - sale form prefill: 75 for a new customer, then the last price for an existing one
  - report page screenshot
  - customer page month headings
- Clean up the test tenant in the local DB.
