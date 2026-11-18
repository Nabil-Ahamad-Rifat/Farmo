import { NextRequest, NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { generateResetToken } from '@/lib/auth/reset-token';
import { checkRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit';
import { mailConfigured, sendMail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000))) {
      return tooManyRequests('Too many requests. Please try again later.');
    }

    const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const { email } = parsed.data;

    if (!(await checkRateLimit(`forgot-password-email:${email}`, 3, 15 * 60 * 1000))) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const dev = process.env.NODE_ENV === 'development';
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    let appUrl: string;
    if (dev) {
      appUrl = req.nextUrl.origin;
    } else {
      try {
        const parsedAppUrl = new URL(configuredAppUrl);
        if (parsedAppUrl.protocol !== 'https:' || !mailConfigured()) throw new Error('Password reset is not configured');
        appUrl = parsedAppUrl.origin;
      } catch {
        console.error('Password reset is unavailable: configure NEXT_PUBLIC_APP_URL and an email service.');
        return NextResponse.json({ error: 'Password reset is temporarily unavailable. Please contact support.' }, { status: 503 });
      }
    }

    // Always return success to avoid user enumeration attacks
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = await generateResetToken(email);
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const expires = new Date(Date.now() + 30 * 60 * 1000).toUTCString();
    // Keep provider details out of the response; only surface a generic send failure.
    const sent = await sendMail({
      to: email,
      subject: 'Reset your Farm Manager password',
      text: `Reset your Farm Manager password: ${resetUrl}\n\nThis link expires in 30 minutes (${expires}). If you didn't request this, you can ignore this email.`,
      html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
              <div style="background:#047857;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center">
                <span style="color:white;font-size:18px">🌱</span>
              </div>
              <span style="font-size:18px;font-weight:800;color:#0f172a">Farm Manager</span>
            </div>
            <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px">Reset your password</h1>
            <p style="color:#64748b;margin:0 0 24px">Click the button below to set a new password. This link expires in 30 minutes.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#047857;color:white;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;font-size:14px">
              Reset Password →
            </a>
            <p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't request this, you can ignore this email.</p>
            <p style="color:#cbd5e1;font-size:11px;margin-top:4px">Link expires at ${expires}</p>
          </div>
        `,
    });
    if (!sent) {
      if (dev) {
        // No email service on the development machine: hand the link to the
        // page so it can be used right away. A relative link, so it opens on
        // whichever device asked (phone or computer). Never in production —
        // there the link must only ever go to the account's own inbox.
        console.log(`\n=== PASSWORD RESET LINK (dev mode) ===\n${resetUrl}\n======================================\n`);
        return NextResponse.json({ message: 'Email is not set up on this computer.', devResetUrl: `/reset-password?token=${token}` });
      }
      console.error('Password reset email was not accepted by the configured email service.');
      return NextResponse.json({ error: 'Password reset email could not be sent. Please try again later.' }, { status: 503 });
    }

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err: unknown) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
