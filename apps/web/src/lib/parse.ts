export function parseNullableFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const parsed = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(parsed) ? parsed : null;
}
