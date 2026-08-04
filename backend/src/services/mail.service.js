import nodeMailer from "nodemailer";

const getMailUser = () => (process.env.MAIL_USER || process.env.EMAIL_USER || "").trim();
const getMailPass = () => (process.env.MAIL_PASS || process.env.EMAIL_PASS || "").replace(/\s+/g, "").trim();

const transporter = nodeMailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.MAIL_PORT) || 465,
    secure: (Number(process.env.MAIL_PORT) || 465) === 465,
    auth: {
        get user() { return getMailUser(); },
        get pass() { return getMailPass(); },
    }
});

export const sendResetPasswordEmail = async (email, resetUrl) => {
    const year = new Date().getFullYear();

    const mailOptions = {
        from: `"Notesify" <${getMailUser()}>`,
        to: email,
        subject: "Reset Your Notesify Password 🔑",
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%); padding: 48px 40px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Notesify</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase;">Password Reset</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 24px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0a0a0a;">Reset your password</h2>
              <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                We received a request to reset the password for the account associated with <strong style="color: #0a0a0a;">${email}</strong>.
              </p>
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                Click the button below to choose a new password. This link will expire in <strong style="color: #0a0a0a;">15 minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 40px 32px 40px; text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; padding: 16px 48px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">Reset Password →</a>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefce8; border-radius: 12px; border-left: 4px solid #eab308;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top" style="font-size: 24px;">⚠️</td>
                        <td style="padding-left: 12px;">
                          <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #854d0e;">Didn't request this?</p>
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a16207;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and no action is needed.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Link Fallback -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">If the button above doesn't work, copy and paste this link into your browser:</p>
              <p style="margin: 0; font-size: 13px; color: #6b7280; word-break: break-all;">${resetUrl}</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">
                This is an automated message from Notesify. Please do not reply to this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">
                © ${year} Notesify. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Reset email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending reset email:", error);
        throw new Error("Failed to send reset email");
    }
};

export const sendWelcomeEmail = async (email, name) => {
    const year = new Date().getFullYear();
    const dashboardUrl = process.env.FRONTEND_URL;
    const firstName = name ? name.split(" ")[0] : "there";

    const mailOptions = {
        from: `"Notesify" <${getMailUser()}>`,
        to: email,
        subject: `Welcome to Notesify, ${firstName}! 🎉`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%); padding: 48px 40px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Notesify</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase;">Your Intelligent Workspace</p>
            </td>
          </tr>

          <!-- Welcome Message -->
          <tr>
            <td style="padding: 40px 40px 24px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0a0a0a;">Welcome aboard, ${firstName}! 👋</h2>
              <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                We're thrilled to have you on Notesify — the smarter way to capture, organize, and supercharge your notes with AI.
              </p>
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                Your account is all set up and ready to go. Here's what you can do right away:
              </p>
            </td>
          </tr>

          <!-- Feature Cards -->
          <tr>
            <td style="padding: 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Feature 1 -->
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; border-left: 4px solid #0a0a0a;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="40" valign="top" style="font-size: 24px;">🤖</td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0a0a0a;">AI-Powered Assistant</p>
                                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">Ask questions, summarize notes, brainstorm ideas — your personal AI assistant is built right in.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 2 -->
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; border-left: 4px solid #0a0a0a;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="40" valign="top" style="font-size: 24px;">📂</td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0a0a0a;">Smart Organization</p>
                                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">Folders, favorites, and trash — keep your workspace clean and find anything in seconds.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Feature 3 -->
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 12px; border-left: 4px solid #0a0a0a;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="40" valign="top" style="font-size: 24px;">🔒</td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0a0a0a;">Secure & Private</p>
                                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">Your notes are encrypted and protected. Only you have access to your data.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 32px 40px 16px 40px; text-align: center;">
              <a href="${dashboardUrl}" style="display: inline-block; padding: 16px 48px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">Open Your Dashboard →</a>
            </td>
          </tr>

          <!-- Subtext -->
          <tr>
            <td style="padding: 0 40px 40px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">We've already created a welcome note for you to get started.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">
                You're receiving this because you just created a Notesify account with <strong style="color: #6b7280;">${email}</strong>.
              </p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">
                © ${year} Notesify. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending welcome email:", error);
        throw new Error("Failed to send welcome email");
    }
};

export const sendVerificationEmail = async (email, name, verificationUrl) => {
    const year = new Date().getFullYear();
    const firstName = name ? name.split(" ")[0] : "friend";

    const mailOptions = {
        from: `"Notesify" <${getMailUser()}>`,
        to: email,
        subject: "Verify your Notesify account 📧",
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%); padding: 48px 40px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Notesify</h1>
              <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase;">Account Verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 40px 24px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0a0a0a;">Confirm your email, ${firstName}!</h2>
              <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                Thanks for joining Notesify! Before you can start supercharging your notes with AI, we just need to verify that <strong style="color: #0a0a0a;">${email}</strong> belongs to you.
              </p>
              <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                Click the button below to verify your account. This link will expire in <strong style="color: #0a0a0a;">24 hours</strong>.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 8px 40px 32px 40px; text-align: center;">
              <a href="${verificationUrl}" style="display: inline-block; padding: 16px 48px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px;">Verify Account →</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">
                If you didn't create a Notesify account, you can safely ignore this email.
              </p>
              <p style="margin: 0; font-size: 12px; color: #d1d5db;">
                © ${year} Notesify. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to: ${email}`);
    } catch (error) {
        console.error("Error sending verification email:", error);
        throw new Error("Failed to send verification email");
    }
};
