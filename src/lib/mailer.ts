import 'server-only';
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!user || !appPassword) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: appPassword },
    });
  }
  return transporter;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Returns true if sent, false if mailer isn't configured or sending failed
// (caller treats this as best-effort, never blocks the guest book submit).
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  const fromUser = process.env.GMAIL_USER;
  try {
    await t.sendMail({
      from: `BPS Kabupaten Maros <${fromUser}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('Gmail SMTP send failed:', err);
    return false;
  }
}
