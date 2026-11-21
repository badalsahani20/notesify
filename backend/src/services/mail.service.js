import nodeMailer from "nodemailer";

const cleanEnv = (val) => (val ? String(val).replace(/^["']|["']$/g, "").trim() : "");

const getMailUser = () => cleanEnv(process.env.MAIL_USER || process.env.EMAIL_USER);
const getMailPass = () => cleanEnv(process.env.MAIL_PASS || process.env.EMAIL_PASS).replace(/\s+/g, "");
const getMailHost = () => cleanEnv(process.env.MAIL_HOST) || "smtp.gmail.com";
const getMailPort = () => {
    const raw = cleanEnv(process.env.MAIL_PORT);
    const parsed = Number(raw);
    return !isNaN(parsed) && parsed > 0 ? parsed : 465;
};
const getMailFrom = () => {
    const customFrom = cleanEnv(process.env.MAIL_FROM || process.env.EMAIL_FROM);
    if (customFrom) {
        return customFrom.includes("<") ? customFrom : `"Notesify" <${customFrom}>`;
    }
    return `"Notesify" <${getMailUser()}>`;
};

let cachedTransporter = null;
let cachedConfigKey = "";

export const getTransporter = () => {
    const user = getMailUser();
    const pass = getMailPass();
    const host = getMailHost();
    const port = getMailPort();
    const configKey = `${host}:${port}:${user}:${pass}`;

    if (!cachedTransporter || cachedConfigKey !== configKey) {
        cachedTransporter = nodeMailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
        });
        cachedConfigKey = configKey;
    }
    return cachedTransporter;
};

export const transporter = {
    sendMail: (options, callback) => getTransporter().sendMail(options, callback),
    verify: (callback) => getTransporter().verify(callback),
};

export const verifyMailConnection = async () => {
    return getTransporter().verify();
};

export const sendResetPasswordEmail = async (email, resetUrl) => {
    const year = new Date().getFullYear();

    const mailOptions = {
        from: getMailFrom(),
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
    const dashboardUrl = process.env.FRONTEND_URL || "https://notesify.in";
    const firstName = name ? name.split(" ")[0] : "there";

    const mailOptions = {
        from: getMailFrom(),
        to: email,
        subject: `Welcome to Notesify, ${firstName}!`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Notesify</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0c0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e4e4e7; -webkit-font-smoothing: antialiased;">
  <!-- Hallmark · component: welcome-email · genre: modern-minimal · theme: obsidian · contrast: AAA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c0c0e; padding: 48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #141417; border: 1px solid #232328; border-radius: 12px; overflow: hidden; text-align: left;">

          <!-- Top Brand Bar -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #232328;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.4px;">Notesify</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">Getting Started</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Editorial Lead -->
          <tr>
            <td style="padding: 36px 36px 20px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; line-height: 1.3; color: #ffffff; letter-spacing: -0.5px;">
                Notes you will actually remember.
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Welcome aboard, ${firstName}!
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Most notes end up as a graveyard of forgotten text. Notesify gives your writing a second life: whenever you finish capturing an idea, you can test yourself on it immediately.
              </p>
            </td>
          </tr>

          <!-- Asymmetric Flow (Anti-slop: No card-in-card, clean typographic pacing) -->
          <tr>
            <td style="padding: 12px 36px 28px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Step 01 -->
                <tr>
                  <td width="36" valign="top" style="padding: 12px 0 16px 0; font-size: 12px; font-weight: 700; color: #52525b; font-family: monospace;">01</td>
                  <td style="padding: 12px 0 16px 12px; border-bottom: 1px solid #1f1f24;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #ffffff;">Turn any note into a quiz</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #71717a;">Click the green Study button on any note to generate interactive practice questions and flashcards. Testing yourself is the single fastest way to retain knowledge.</p>
                  </td>
                </tr>

                <!-- Step 02 -->
                <tr>
                  <td width="36" valign="top" style="padding: 16px 0 16px 0; font-size: 12px; font-weight: 700; color: #52525b; font-family: monospace;">02</td>
                  <td style="padding: 16px 0 16px 12px; border-bottom: 1px solid #1f1f24;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #ffffff;">AI-Powered Assistant (Iris)</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #71717a;">Highlight confusing paragraphs to get simple analogies, clear summaries, or answers that connect insights across all your past notes.</p>
                  </td>
                </tr>

                <!-- Step 03 -->
                <tr>
                  <td width="36" valign="top" style="padding: 16px 0 8px 0; font-size: 12px; font-weight: 700; color: #52525b; font-family: monospace;">03</td>
                  <td style="padding: 16px 0 8px 12px;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #ffffff;">True offline freedom</p>
                    <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #71717a;">Write freely on trains, flights, or spotty connections. Your thoughts save locally first and synchronize quietly the moment you're online.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Primary CTA (Single crisp container, no decorative glow slop) -->
          <tr>
            <td style="padding: 0 36px 36px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 16px; background-color: #1a1a1f; border: 1px solid #27272e; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 14px 0; font-size: 13px; color: #a1a1aa;">
                      A sample note with a 30-second practice quiz is already waiting in your workspace.
                    </p>
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 32px; background-color: #ffffff; color: #0c0c0e; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: -0.2px;">Open Workspace &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Minimal Colophon Footer -->
          <tr>
            <td style="padding: 24px 36px; border-top: 1px solid #1f1f24; text-align: left;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 11px; color: #52525b; line-height: 1.5;">
                    Sent to <span style="color: #71717a;">${email}</span> for your Notesify account.<br />
                    &copy; ${year} Notesify. Built for focused learning.
                  </td>
                </tr>
              </table>
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

export const sendVerificationEmail = async (email, name, verificationUrl, verificationOtp) => {
    const year = new Date().getFullYear();
    const firstName = name ? name.split(" ")[0] : "friend";

    const otpSection = verificationOtp ? `
          <!-- 6-Digit OTP Box -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border: 1px dashed #d1d5db; border-radius: 12px; text-align: center;">
                <tr>
                  <td style="padding: 24px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px;">Your 6-Digit Verification Code</p>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0a0a0a; font-family: 'Courier New', Courier, monospace;">${verificationOtp}</div>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Enter this code directly in the Notesify app (expires in 15 minutes)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
    ` : "";

    const mailOptions = {
        from: getMailFrom(),
        to: email,
        subject: verificationOtp ? `${verificationOtp} is your Notesify verification code 🔑` : "Verify your Notesify account 📧",
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
            <td style="padding: 40px 40px 16px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0a0a0a;">Confirm your email, ${firstName}!</h2>
              <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.7; color: #4a4a4a;">
                Thanks for joining Notesify! Enter the verification code below in your Notesify app, or click the verification link.
              </p>
            </td>
          </tr>

${otpSection}

          <!-- Fallback Link CTA Button -->
          <tr>
            <td style="padding: 0 40px 32px 40px; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">Or verify via browser link:</p>
              <a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: #0a0a0a; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">Verify Account Link →</a>
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
