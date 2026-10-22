# Default milk price, monthly customer history, monthly report

Approved by the owner on 2026-10-06. Web app only; the mobile app is unchanged.

## 1. Default milk price
- `Tenant.defaultMilkPrice Float?`. Null means ৳70.
- Settings gets a "Default milk price" field. `GET/PUT /api/settings` reads and writes it for the current tenant.
- Sale form (new sale):
  - Product defaults to milk, as it does now.
  - Choosing a customer fills the price per litre. It uses that customer's most recent milk `unitPrice` (by sale date); if they have none, the default price.
  - Picking a different customer refills the price.
  - Once the user types a price, it is never overwritten.
  - Switching the product away from milk and back refills the price.
- Editing an existing sale keeps its own price.
- `lastMilkPrice` is added to the customer list data used by the sales page and the customer page.

## 2. Customer history grouped by month
- The customer page history is grouped under month headings, newest first.
- Each heading shows milk litres, sold ৳, paid ৳, and the due at month end (or the advance).
- Rows are unchanged.
- The "Still due" card keeps showing the due right now.

## 3. Monthly report: `/dashboard/reports?month=YYYY-MM`
- A month picker (previous/next) defaults to the current month. The nav entry is "Monthly Report".
- Farm totals:
  - milk sold (L)
  - total sales ৳ (all products)
  - collected ৳
  - due carried in
  - due at month end
- Customer table: every customer with a sale or payment in the month, or a non-zero balance carried in. Columns:
  - name and type
  - L
  - sold ৳
  - paid ৳
  - carried in
  - due at month end, or advance
- Rows that still owe are highlighted and get a Collect button. The name links to `/dashboard/customers/:id#m-YYYY-MM`.
- Legacy sales with no customer get one "No customer" row:
  - sold = their amount
  - paid = the amount of those marked paid
  - carried in = the unpaid amount of earlier ones
  - month-end due = carried in + unpaid this month

## Rules
- Months are UTC calendar months. Sale and payment days are stored at noon UTC, so this is safe.
- Paid this month = payments whose `paidAt` falls in the month.
- Carried in = sales before the month − payments before the month. It can be negative, meaning advance.
- Month end = carried in + sold − paid.
- Farm due at month end = the sum of each customer's positive month-end balance. One customer's advance never offsets another customer's due, matching `totalReceivable`.
- Everything is computed live. Months are never locked.

## Units
- Pure `monthlyStatement()` in `@farm/business-logic`, unit-tested.
- `apps/web/src/lib/monthly-report.ts` fetches the data and calls it.
- The report page and the customer page both use this one calculation.

## Testing
- Unit tests:
  - carry-over
  - advance
  - a payment in a later month
  - legacy sales
  - milk litres counted only for milk sales
- API smoke test and headless-Chrome screenshots, on the local DB only.
