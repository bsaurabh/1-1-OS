import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = 'noreply@resend.dev'
const APP_NAME = '1:1OS'

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <p>You requested a password reset for your ${APP_NAME} account.</p>
      <p>
        <a href="${resetUrl}">Click here to reset your password</a>
      </p>
      <p>This link expires in 60 minutes. If you did not request this, you can safely ignore this email.</p>
    `,
  })
}
