import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, code: string) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    console.warn("Email service is not configured. Verification code:", code);
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.FROM_EMAIL,
      to: [email],
      subject: 'Verify your VeoLMS Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Welcome to VeoLMS!</h2>
          <p>Thank you for signing up. Please verify your email address to continue.</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <h1 style="font-size: 32px; letter-spacing: 4px; color: #1f2937; margin: 0;">${code}</h1>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
