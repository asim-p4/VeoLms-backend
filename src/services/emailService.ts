import { Resend } from 'resend';
import { env } from '../config/env';

/**
 * Generates modern, responsive HTML email template for verification codes.
 */
function getVerificationEmailHtml(code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 12px 20px; border-radius: 12px; margin-bottom: 12px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">VeoLMS</h1>
        </div>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Next-Generation Learning Management System</p>
      </div>

      <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 12px 0;">Welcome to VeoLMS!</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Thank you for creating an account. Please verify your email address by entering the code below:
      </p>

      <div style="background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%); border: 2px dashed #c7d2fe; padding: 24px; border-radius: 14px; text-align: center; margin: 24px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Verification Code</div>
        <div style="font-size: 38px; letter-spacing: 10px; color: #1e1b4b; font-weight: 900; font-family: 'Courier New', monospace; margin: 0;">${code}</div>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0;">
        ⏳ This verification code will expire in <strong>15 minutes</strong>. If you did not request this, please disregard this email.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;" />

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        © ${new Date().getFullYear()} VeoLMS. All rights reserved.
      </p>
    </div>
  `;
}

/**
 * Sends verification email using Brevo's HTTPS REST API.
 * Runs over standard HTTPS Port 443 (supported on Render and all cloud hosts).
 */
async function sendViaBrevo(email: string, code: string): Promise<void> {
  const senderEmail = env.FROM_EMAIL || 'asimsaleem9090@gmail.com';
  const senderName = env.FROM_NAME || 'VeoLMS';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY!,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: email,
        },
      ],
      subject: 'Verify your VeoLMS Account',
      htmlContent: getVerificationEmailHtml(code),
    }),
  });

  if (!response.ok) {
    const errorBody: any = await response.json().catch(() => null);
    const errorMessage = errorBody?.message || `Brevo request failed with status ${response.status}`;
    console.error('[EmailService] Brevo API rejected email:', errorMessage);
    throw new Error(errorMessage);
  }

  const result: any = await response.json().catch(() => null);
  console.log(`[EmailService] Verification email sent via Brevo to ${email} (Message ID: ${result?.messageId || 'ok'})`);
}

/**
 * Sends verification email using Resend's HTTPS REST API.
 */
async function sendViaResend(email: string, code: string): Promise<void> {
  const resend = new Resend(env.RESEND_API_KEY);

  let fromAddress = env.FROM_EMAIL || 'VeoLMS <onboarding@resend.dev>';
  if (/@(gmail|yahoo|outlook|hotmail)\.com/i.test(fromAddress)) {
    console.warn(`[EmailService] Cannot use public email domain (${fromAddress}) as sender in Resend. Falling back to VeoLMS <onboarding@resend.dev>`);
    fromAddress = 'VeoLMS <onboarding@resend.dev>';
  }

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [email],
    subject: 'Verify your VeoLMS Account',
    html: getVerificationEmailHtml(code),
  });

  if (error) {
    console.error('[EmailService] Resend API rejected email:', error);
    throw new Error(error.message);
  }

  console.log(`[EmailService] Verification email sent via Resend to ${email} (Message ID: ${data?.id})`);
}

/**
 * Sends a 6-digit email verification code using Brevo or Resend HTTPS REST API.
 * This runs over Port 443 (HTTPS), which is fully supported on Render and cloud hosts.
 *
 * @param email - Recipient's email address
 * @param code - 6-digit numeric verification code
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  // 1. Try Brevo if BREVO_API_KEY is configured
  if (env.BREVO_API_KEY) {
    return sendViaBrevo(email, code);
  }

  // 2. Try Resend if RESEND_API_KEY is configured
  if (env.RESEND_API_KEY) {
    return sendViaResend(email, code);
  }

  // 3. Fallback when no email key is configured
  console.warn(`[EmailService] ⚠️ Neither BREVO_API_KEY nor RESEND_API_KEY is configured. Verification code for ${email}: ${code}`);
  if (env.NODE_ENV === 'production') {
    throw new Error("No email service API key (BREVO_API_KEY or RESEND_API_KEY) is configured on the server.");
  }
}
