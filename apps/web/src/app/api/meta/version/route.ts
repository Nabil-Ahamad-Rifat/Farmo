import { NextResponse } from 'next/server';

// Unauthenticated — the mobile app checks this at launch, before login, to
// decide whether it needs to show a blocking "please update" screen. This
// is what makes it safe to ship breaking-ish backend changes later without
// needing an app-store review cycle to force-fix an old client.
export async function GET() {
  const minSupportedVersion = process.env.MOBILE_MIN_SUPPORTED_VERSION || '1.0.0';

  return NextResponse.json({
    minSupportedVersion,
    latestVersion: process.env.MOBILE_LATEST_VERSION || minSupportedVersion,
    forceUpdateBelow: process.env.MOBILE_FORCE_UPDATE_BELOW || minSupportedVersion,
  });
}
