"use strict";

/**
 * POST /api/auth/send-otp
 *
 * Generates a cryptographically secure 6-digit OTP, stores its SHA-256 hash
 * in Firestore (otpVerifications collection), and sends the plaintext OTP
 * to the user's email via Resend. The plaintext OTP is NEVER stored, logged,
 * or returned in the API response.
 *
 * Request body:
 *   { "email": "user@example.com" }
 *
 * Response (always same shape to prevent email enumeration):
 *   { "success": true, "message": "..." }
 */

const crypto = require("crypto");
const { initAdmin, FieldValue, Timestamp } = require("./firebaseAdmin");
const { Resend } = require("resend");
const nodemailer = require("nodemailer");

// ── Email Transporter (Gmail SMTP) ────────────────────────────────────
let _gmailTransporter = null;
function getGmailTransporter() {
  if (!_gmailTransporter && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    _gmailTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ""),
      },
    });
  }
  return _gmailTransporter;
}

// ── Constants (from env with safe defaults) ───────────────────────────
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5;
const RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60;
const MAX_SENDS_PER_HOUR = parseInt(process.env.OTP_MAX_SENDS_PER_HOUR, 10) || 5;

const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "The Sugar Atelier";
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@thesugaratelier.com";

// ── Email validation ──────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalize an email address: lowercase, trim whitespace.
 */
function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses Node.js built-in crypto.randomInt — NOT Math.random().
 */
function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash the OTP using SHA-256.
 * Only the hash is stored — never the plaintext OTP.
 */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Build the HTML body for the verification email.
 * The OTP value is embedded here and sent to the user's inbox.
 * It is not stored or returned anywhere else.
 */
function buildEmailHtml(email, otp) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email — The Sugar Atelier</title>
</head>
<body style="margin:0;padding:0;background:#f9f3f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f3f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#8B3A62 0%,#6e294b 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                The Sugar <span style="color:#f9c8d9;">Atelier</span>
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Premium Handcrafted Cakes</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#2d1a24;font-weight:700;">
                Verify Your Email Address
              </h2>
              <p style="margin:0 0 20px;font-size:14px;color:#5a4a52;line-height:1.65;">
                Hi there! We received a request to create an account at The Sugar Atelier for
                <strong style="color:#8B3A62;">${email}</strong>.
                Please use the verification code below to complete your registration.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background:#fdf2f6;border:2px dashed #d4849e;border-radius:12px;padding:24px 16px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8B3A62;">
                      Your Verification Code
                    </p>
                    <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#6e294b;font-family:'Courier New',monospace;">
                      ${otp}
                    </p>
                    <p style="margin:10px 0 0;font-size:12px;color:#9e7a8a;">
                      Expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Warnings -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f3;border-left:3px solid #e8845a;border-radius:0 8px 8px 0;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:13px;color:#6b3a1f;line-height:1.6;">
                      🔒 <strong>Do not share this code</strong> with anyone, including our support team.
                      The Sugar Atelier will never ask for your verification code.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#5a4a52;line-height:1.6;">
                If you did not request this code, you can safely ignore this email. No account will be created without verification.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f0e4ea;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9e8e95;line-height:1.6;">
                Need help? Contact us at
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#8B3A62;text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#b8a8ae;">
                © ${new Date().getFullYear()} The Sugar Atelier. All rights reserved.
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

/**
 * Build a plain-text fallback for email clients that don't render HTML.
 */
function buildEmailText(email, otp) {
  return [
    "THE SUGAR ATELIER — EMAIL VERIFICATION",
    "======================================",
    "",
    `A verification code has been requested for: ${email}`,
    "",
    `Your verification code: ${otp}`,
    "",
    `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    "",
    "DO NOT share this code with anyone, including support staff.",
    "The Sugar Atelier will never ask for your code.",
    "",
    "If you did not request this, please ignore this email.",
    "",
    `Need help? Email: ${SUPPORT_EMAIL}`,
    `© ${new Date().getFullYear()} The Sugar Atelier`,
  ].join("\n");
}

// ── Main Handler ──────────────────────────────────────────────────────

module.exports = async function sendOtpHandler(req, res) {
  // ── 1. Input validation ───────────────────────────────────────────
  const { email: rawEmail } = req.body;

  if (!rawEmail || typeof rawEmail !== "string") {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  const email = normalizeEmail(rawEmail);

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  // ── 2. Firestore per-email rate limiting ──────────────────────────
  let db;
  try {
    ({ db } = initAdmin());
  } catch (initErr) {
    console.error("[sendOtp] Firebase Admin init error:", initErr.message);
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }

  const otpRef = db.collection("otpVerifications").doc(email);

  try {
    const now = Date.now();

    const existing = await otpRef.get();
    if (existing.exists) {
      const data = existing.data();

      // Enforce minimum cooldown between sends
      if (data.lastSentAt) {
        const lastSentMs = data.lastSentAt.toMillis ? data.lastSentAt.toMillis() : data.lastSentAt;
        const secondsSinceLast = (now - lastSentMs) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          const waitSecs = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
          return res.status(429).json({
            success: false,
            message: `Please wait ${waitSecs} second(s) before requesting another code.`,
            waitSeconds: waitSecs,
          });
        }
      }

      // Enforce maximum sends per hour
      const sendsInWindow = (data.sendsInHour || []).filter(
        (ts) => now - ts < 60 * 60 * 1000
      );
      if (sendsInWindow.length >= MAX_SENDS_PER_HOUR) {
        return res.status(429).json({
          success: false,
          message: "Too many verification requests for this email. Please try again in an hour.",
        });
      }
    }

    // ── 3. Generate OTP (cryptographically secure, never stored plaintext) ──
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const createdAt = FieldValue.serverTimestamp();
    const expiresAt = new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Build updated sendsInHour log
    const prevSends = existing.exists
      ? (existing.data().sendsInHour || []).filter((ts) => now - ts < 60 * 60 * 1000)
      : [];
    prevSends.push(now);

    // ── 4. Store only the hash in Firestore ───────────────────────────
    await otpRef.set({
      emailNormalized: email,
      otpHash,
      createdAt,
      expiresAt: Timestamp.fromDate(expiresAt),
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      used: false,
      lastSentAt: FieldValue.serverTimestamp(),
      sendsInHour: prevSends,
    });
    // Plaintext OTP is in memory only — stored hash above, plaintext goes to email only

    // ── 5. Send email via Gmail SMTP or Resend ───────────────────────
    let emailSent = false;
    let deliveryError = null;

    // Option A: Gmail SMTP (preferred when configured — sends to any email address)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const transporter = getGmailTransporter();
        await transporter.sendMail({
          from: `"${EMAIL_FROM_NAME}" <${process.env.GMAIL_USER.trim()}>`,
          to: email,
          subject: "Verify your email address — The Sugar Atelier",
          html: buildEmailHtml(email, otp),
          text: buildEmailText(email, otp),
        });
        emailSent = true;
      } catch (gmailErr) {
        deliveryError = gmailErr;
        console.error("[sendOtp] Gmail SMTP delivery error:", gmailErr.message || gmailErr);
      }
    } else if (process.env.RESEND_API_KEY) {
      // Option B: Resend API
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error: resendErr } = await resend.emails.send({
          from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
          to: [email],
          subject: "Verify your email address — The Sugar Atelier",
          html: buildEmailHtml(email, otp),
          text: buildEmailText(email, otp),
        });
        if (resendErr) {
          deliveryError = resendErr;
          console.error("[sendOtp] Resend delivery error:", resendErr);
        } else {
          emailSent = true;
        }
      } catch (resendCatchErr) {
        deliveryError = resendCatchErr;
        console.error("[sendOtp] Resend exception:", resendCatchErr);
      }
    } else {
      // Development fallback: no provider configured
      if (process.env.NODE_ENV !== "production") {
        console.log(`[sendOtp] DEV MODE — No email provider configured. OTP for ${email} generated and stored (hashed).`);
      }
      emailSent = true;
    }

    if (!emailSent) {
      // Delivery failed — clean up the stored OTP so user can retry
      await otpRef.delete().catch(() => {});
      const isDev = process.env.NODE_ENV !== "production";
      const errDetail = deliveryError?.message || "Email delivery failed.";
      return res.status(502).json({
        success: false,
        message: isDev
          ? `Email delivery error: ${errDetail}`
          : "Unable to send the verification email. Please try again later.",
      });
    }

    // ── 6. Respond — NEVER include OTP in response ────────────────────
    return res.status(200).json({
      success: true,
      message: "If this email address can receive messages, a verification code has been sent.",
    });
  } catch (err) {
    console.error("[sendOtp] Unexpected error:", err);
    return res.status(500).json({
      success: false,
      message: "Unable to send the verification email. Please try again later.",
    });
  }
};
