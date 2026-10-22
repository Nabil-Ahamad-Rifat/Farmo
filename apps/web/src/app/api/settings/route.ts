import { farmSettingsSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, withOwner } from '@/lib/middleware/withAuth';
import { DEFAULT_MILK_PRICE } from '@/lib/settings';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    // tenantName is shown in the mobile app's header, like the web's farm badge.
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { defaultMilkPrice: true, name: true } });
    return Response.json({ defaultMilkPrice: tenant?.defaultMilkPrice ?? DEFAULT_MILK_PRICE, tenantName: tenant?.name ?? 'Farm Manager' });
  } catch (err: unknown) {
    console.error('Error loading settings:', err);
    return Response.json({ error: 'Failed to load settings' }, { status: 500 });
  }
});

export const PUT = withOwner(async (req, { tenantId }) => {
  try {
    const parsed = farmSettingsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 400 });
    }
    await db.tenant.update({ where: { id: tenantId }, data: { defaultMilkPrice: parsed.data.defaultMilkPrice } });
    return Response.json(parsed.data);
  } catch (err: unknown) {
    console.error('Error saving settings:', err);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
});
