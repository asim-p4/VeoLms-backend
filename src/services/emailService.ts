import { Resend } from 'resend';
import { env } from '../config/env';

/**
 * Sends a 6-digit email verification code using Resend's HTTPS REST API.
 * This runs over Port 443 (HTTPS), which is fully supported on Render and cloud hosts.
 *
 * @param email - Recipient's email address
 * @param code - 6-digit numeric verification code
 */
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[EmailService] ⚠️ RESEND_API_KEY is not configured. Verification code for ${email}: ${code}`);
    if (env.NODE_ENV === 'production') {
      throw new Error("RESEND_API_KEY is not configured on the server.");
    }
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const fromAddress = env.FROM_EMAIL || 'VeoLMS <onboarding@resend.dev>';

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Verify your VeoLMS Account',
      html: `
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
      `,
    });

    if (error) {
      console.error("[EmailService] Resend API rejected email:", error);
      throw new Error(error.message);
    }

    console.log(`[EmailService] Verification email sent to ${email} (Message ID: ${data?.id})`);
  } catch (error: any) {
    console.error("[EmailService] Error sending email via Resend:", error?.message || error);
    throw error;
  }
}
