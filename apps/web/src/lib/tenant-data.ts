import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Deletes every record of a farm (tenant) and then the farm itself, in an
 * order the relations allow. Users must already be gone (User.tenant is a
 * required relation). Only SalaryPayment->Employee and FeedUsage->FeedBatch
 * cascade automatically (see prisma/schema.prisma); everything else needs an
 * explicit delete. Used by account deletion and the daily cleanup of farms
 * nobody can sign in to any more.
 */
export async function deleteTenantData(tx: Tx, tenantId: string): Promise<void> {
  await tx.sale.deleteMany({ where: { tenantId } });
  await tx.payment.deleteMany({ where: { tenantId } });
  await tx.customer.deleteMany({ where: { tenantId } });
  // Worker records before the workers. Older salary payments have no
  // tenantId, so they are found through their worker.
  await tx.salaryPayment.deleteMany({ where: { employee: { tenantId } } });
  await tx.salaryPayment.deleteMany({ where: { tenantId } });
  await tx.payRate.deleteMany({ where: { tenantId } });
  await tx.employeeAbsence.deleteMany({ where: { tenantId } });
  await tx.workEntry.deleteMany({ where: { tenantId } });
  await tx.employee.deleteMany({ where: { tenantId } });
  // Animal photos and history before the animals themselves.
  await tx.animalEvent.deleteMany({ where: { tenantId } });
  await tx.animalPhoto.deleteMany({ where: { tenantId } });
  await tx.cow.updateMany({ where: { tenantId }, data: { motherId: null } });
  await tx.cow.deleteMany({ where: { tenantId } });
  await tx.feedBatch.deleteMany({ where: { tenantId } });
  // After feed batches, which point at suppliers.
  await tx.supplierPayment.deleteMany({ where: { tenantId } });
  await tx.supplier.deleteMany({ where: { tenantId } });
  await tx.otherExpense.deleteMany({ where: { tenantId } });
  await tx.otherIncome.deleteMany({ where: { tenantId } });
  await tx.idempotencyKey.deleteMany({ where: { tenantId } });
  await tx.importStage.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}
