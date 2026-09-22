"use strict";

/**
 * POST /api/auth/forgot-password
 *
 * Checks if the user exists in Firebase Auth, generates a secure password reset
 * link using Firebase Admin SDK, and sends a luxury branded email via Gmail SMTP
 * or Resend.
 *
 * Request body:
 *   { "email": "user@example.com" }
 *
 * Response:
 *   { "success": true, "message": "Password reset link sent to your email!" }
 */

const { initAdmin } = require("./firebaseAdmin");
const nodemailer = require("nodemailer");
const { Resend } = require("resend");

// ── Email Transporter (Gmail SMTP) ────────────────────────────────────
let _gmailTransporter = null;
function getGmailTransporter() {
  if (!_gmailTransporter && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    _gmailTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return _gmailTransporter;
}

const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "The Sugar Atelier";
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@thesugaratelier.com";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Build luxury HTML email for password reset
 */
function buildResetEmailHtml(email, resetLink) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password — The Sugar Atelier</title>
</head>
<body style="margin:0;padding:0;background:#f9f3f6;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f3f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(139,58,98,0.12);border:1px solid #f0e1e7;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #5c1e3a 0%, #8B3A62 50%, #c46a92 100%);padding:36px 32px;text-align:center;">
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:1px;font-family:'Playfair Display',Georgia,serif;">
                The Sugar <span style="color:#f9c8d9;">Atelier</span>
              </h1>
              <p style="margin:0;color:rgba(255,255,255,0.85);font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">
                Account Security & Recovery
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:38px 36px 28px;text-align:left;">
              <h2 style="margin:0 0 14px;color:#2b2023;font-size:20px;font-weight:700;">
                Reset Your Password
              </h2>
              <p style="margin:0 0 20px;color:#55474a;font-size:15px;line-height:1.65;">
                We received a request to reset the password for your Sugar Atelier account (<strong style="color:#8B3A62;">${email}</strong>).
              </p>
              <p style="margin:0 0 28px;color:#55474a;font-size:15px;line-height:1.65;">
                Click the button below to set a new, secure password:
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg, #8B3A62, #c46a92);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 36px;border-radius:10px;box-shadow:0 6px 20px rgba(139,58,98,0.32);letter-spacing:0.5px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <div style="background:#fcf8f9;border:1px solid #f0dfe5;border-radius:10px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 6px;color:#756B6B;font-size:12px;font-weight:600;">
                  Button not working? Copy and paste this URL into your browser:
                </p>
                <p style="margin:0;word-break:break-all;color:#8B3A62;font-size:12px;line-height:1.5;">
                  <a href="${resetLink}" style="color:#8B3A62;text-decoration:underline;">${resetLink}</a>
                </p>
              </div>

              <!-- Notice -->
              <p style="margin:0 0 10px;color:#88777a;font-size:13px;line-height:1.5;">
                ⏱ <strong>Security Notice:</strong> This link is valid for 1 hour and can only be used once.
              </p>
              <p style="margin:0;color:#88777a;font-size:13px;line-height:1.5;">
                If you did not request this change, please ignore this email. Your password will remain unchanged and your account is completely secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fcf8f9;border-top:1px solid #f0e1e7;padding:22px 36px;text-align:center;">
              <p style="margin:0 0 6px;color:#9b8b8f;font-size:12px;">
                Need help? Contact our concierge at <a href="mailto:${SUPPORT_EMAIL}" style="color:#8B3A62;text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:0;color:#bba8ad;font-size:11px;">
                © 2026 The Sugar Atelier. Handcrafted luxury cakes & confections.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText(email, resetLink) {
  return `The Sugar Atelier — Reset Your Password\n\n` +
    `Hello,\n\n` +
    `We received a request to reset the password for your Sugar Atelier account (${email}).\n\n` +
    `To choose a new password, open this link in your browser:\n` +
    `${resetLink}\n\n` +
    `This link expires in 1 hour.\n\n` +
    `If you did not request a password reset, you can safely ignore this email.\n\n` +
    `Support: ${SUPPORT_EMAIL}\n` +
    `© 2026 The Sugar Atelier`;
}

module.exports = async function forgotPasswordHandler(req, res) {
  try {
    const { email: rawEmail } = req.body || {};

    if (!rawEmail || typeof rawEmail !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const email = normalizeEmail(rawEmail);

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // ── 1. Check user and generate link with Firebase Admin ──────────────
    let resetLink;
    try {
      const { auth } = initAdmin();
      // Check if user exists
      await auth.getUserByEmail(email);
      // Generate secure action link
      resetLink = await auth.generatePasswordResetLink(email);
    } catch (adminErr) {
      console.warn("[forgotPassword] Firebase Admin check:", adminErr.code || adminErr.message);
      if (adminErr.code === "auth/user-not-found") {
        return res.status(404).json({
          success: false,
          message: "No account found with this email address. Please check your email or create an account.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Could not process password reset at this time. Please try again later.",
      });
    }

    // ── 2. Send the reset link via Gmail SMTP or Resend ─────────────────
    let emailSent = false;
    let deliveryErr = null;

    // Method 1: Gmail SMTP
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        console.log(`[forgotPassword] Sending reset link via Gmail SMTP to: ${email}...`);
        const transporter = getGmailTransporter();
        await transporter.sendMail({
          from: `"${EMAIL_FROM_NAME}" <${process.env.GMAIL_USER.trim()}>`,
          to: email,
          subject: "Reset your password — The Sugar Atelier",
          html: buildResetEmailHtml(email, resetLink),
          text: buildResetEmailText(email, resetLink),
        });
        emailSent = true;
        console.log(`[forgotPassword] Reset email dispatched via Gmail SMTP to: ${email}`);
      } catch (gmailErr) {
        deliveryErr = gmailErr;
        console.error("[forgotPassword] Gmail SMTP delivery error:", gmailErr.message || gmailErr);
      }
    }

    // Method 2: Resend API
    if (!emailSent && process.env.RESEND_API_KEY) {
      try {
        console.log(`[forgotPassword] Sending reset link via Resend API to: ${email}...`);
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error: resendErr } = await resend.emails.send({
          from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
          to: [email],
          subject: "Reset your password — The Sugar Atelier",
          html: buildResetEmailHtml(email, resetLink),
          text: buildResetEmailText(email, resetLink),
        });
        if (resendErr) {
          deliveryErr = resendErr;
          console.error("[forgotPassword] Resend delivery error:", resendErr);
        } else {
          emailSent = true;
          console.log(`[forgotPassword] Reset email dispatched via Resend API to: ${email}`);
        }
      } catch (rErr) {
        deliveryErr = rErr;
        console.error("[forgotPassword] Resend exception:", rErr.message || rErr);
      }
    }

    if (!emailSent) {
      console.warn("[forgotPassword] Could not send email via SMTP/Resend. Reset link:", resetLink);
      return res.status(500).json({
        success: false,
        message: "Email delivery service temporarily unavailable. Please try again or contact support.",
        resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: "A password reset link has been sent to your email address!",
    });
  } catch (error) {
    console.error("[forgotPassword] Unhandled error:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};
