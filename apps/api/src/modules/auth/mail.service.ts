import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send a transactional email. Failures are logged but do not throw (best-effort). */
export async function sendMail(message: MailMessage): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.debug({ to: message.to, subject: message.subject }, 'Email sent');
  } catch (err) {
    logger.error({ err, to: message.to }, 'Failed to send email');
    // Do not rethrow — email is best-effort. Callers that must confirm delivery
    // should check the result explicitly. For Phase 0, logging is sufficient.
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Reset your HRMS password',
    text: `We received a request to reset your password. Open this link within 30 minutes:\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your password. Click the link below within 30 minutes:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

export async function sendInvitationEmail(to: string, acceptUrl: string, tenantName: string): Promise<void> {
  await sendMail({
    to,
    subject: `You're invited to join ${tenantName} on HRMS`,
    text: `You have been invited to join ${tenantName}. Accept your invitation:\n\n${acceptUrl}\n\nThis link expires in 7 days.`,
    html: `<p>You have been invited to join <strong>${tenantName}</strong>.</p><p><a href="${acceptUrl}">Accept your invitation</a></p><p>This link expires in 7 days.</p>`,
  });
}
