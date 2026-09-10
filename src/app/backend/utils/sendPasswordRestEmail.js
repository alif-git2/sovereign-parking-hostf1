import { getTransporter } from "./sendBookingEmails";

const transporter = getTransporter();

export default async function sendVerificationEmail(data) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: data.email,
    subject: "Your Password Reset Verification Code",
    html: `
      <div style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:32px;text-align:center;background-color:#2563eb;color:#ffffff;">
                    <h1 style="margin:0;font-size:24px;font-weight:700;">
                      Email Verification
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;color:#111827;">
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                      Hello,
                    </p>

                    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">
                      Please use the verification code below to verify your email address.
                    </p>

                    <div style="margin:24px 0;text-align:center;">
                      <div style="display:inline-block;padding:16px 28px;background-color:#f3f4f6;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:4px;color:#111827;">
                        ${data.code}
                      </div>
                    </div>

                    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                      You can also click the button below to go directly to the verification page.
                    </p>

                    <div style="text-align:center;margin:32px 0;">
                      <a
                        href="${data.link}"
                        target="_blank"
                        style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:600;"
                      >
                        Verify Email Address
                      </a>
                    </div>

                    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6b7280;">
                      If you did not request this verification, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 32px;text-align:center;background-color:#f9fafb;color:#6b7280;font-size:13px;">
                    This is an automated email. Please do not reply.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `,
  });
}