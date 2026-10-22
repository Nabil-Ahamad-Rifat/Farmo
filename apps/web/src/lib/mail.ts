// One way to send email for the whole app. Uses, in order:
//  1. Gmail (or any SMTP) when SMTP_USER and SMTP_PASS are set — free, no
//     domain needed; use a Google "app password", not the account password.
//  2. Resend when RESEND_API_KEY is set — needs a verified domain.
//  3. Nothing: in development the caller shows/logs the message instead; in
//     production sendMail returns false.

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function mailConfigured(): boolean {
  return Boolean((process.env.SMTP_USER && process.env.SMTP_PASS) || process.env.RESEND_API_KEY);
}

/** Sends the message; true when a mail service accepted it. */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    const nodemailer = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || `Farm Manager <${smtpUser}>`,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Farm Manager <no-reply@yourdomain.com>',
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return true;
  }

  return false;
}
