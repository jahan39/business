"use strict";

/**
 * POST /api/auth/verify-otp
 *
 * Verifies the submitted OTP server-side. On success:
 *   1. Marks the OTP as used in Firestore (single-use enforcement)
 *   2. Creates the Firebase Authentication user with emailVerified: true
 *   3. Saves the user profile in Firestore `customers` collection
 *   4. Returns safe session information (uid, name, email)
 *
 * Request body:
 *   {
 *     "email": "user@example.com",
 *     "otp": "123456",
 *     "name": "Full Name",
 *     "phone": "01XXXXXXXXX",
 *     "password": "securepassword"
 *   }
 *
 * Response on success:
 *   { "success": true, "message": "...", "user": { uid, name, email, phone } }
 *
 * NEVER returns the OTP, OTP hash, or any Firebase Admin credentials.
 */

const crypto = require("crypto");
const { initAdmin, FieldValue } = require("./firebaseAdmin");

// ── Constants ─────────────────────────────────────────────────────────
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5;

// ── Helpers ───────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_REGEX = /^\d{6}$/;

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/**
 * Hash OTP with SHA-256 — same algorithm used in sendOtp.js.
 * Submitted OTP is hashed immediately; the plaintext is never stored.
 */
function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Safe string comparison for hashes.
 * crypto.timingSafeEqual requires equal-length Buffers.
 */
function safeCompareHashes(a, b) {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────

module.exports = async function verifyOtpHandler(req, res) {
  // ── 1. Input validation ───────────────────────────────────────────
  const { email: rawEmail, otp: rawOtp, name, phone, password } = req.body;

  if (!rawEmail || typeof rawEmail !== "string") {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  const email = normalizeEmail(rawEmail);

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, message: "Please enter a valid email address." });
  }

  if (!rawOtp || typeof rawOtp !== "string") {
    return res.status(400).json({ success: false, message: "Please enter the 6-digit verification code." });
  }

  const otp = rawOtp.trim();

  if (!OTP_REGEX.test(otp)) {
    return res.status(400).json({ success: false, message: "Verification code must be exactly 6 digits." });
  }

  // Registration fields (required for account creation after OTP verification)
  const fullName = typeof name === "string" ? name.trim() : "";
  const phoneNumber = typeof phone === "string" ? phone.trim() : "";

  if (!fullName) {
    return res.status(400).json({ success: false, message: "Please provide your full name." });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  }

  // ── 2. Initialize Firebase Admin ──────────────────────────────────
  let db;
  let authAdmin;
  try {
    const adminInit = initAdmin();
    db = adminInit.db;
    authAdmin = adminInit.auth;
  } catch (initErr) {
    console.error("[verifyOtp] Firebase Admin init error:", initErr.message);
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again later.",
    });
  }

  // ── 3. Look up pending OTP document ──────────────────────────────
  const otpRef = db.collection("otpVerifications").doc(email);
  let otpDoc;

  try {
    otpDoc = await otpRef.get();
  } catch (dbErr) {
    console.error("[verifyOtp] Firestore read error:", dbErr);
    return res.status(500).json({
      success: false,
      message: "An error occurred. Please try again later.",
    });
  }

  if (!otpDoc.exists) {
    return res.status(400).json({
      success: false,
      message: "No verification code found for this email. Please request a new code.",
    });
  }

  const otpData = otpDoc.data();

  // ── 4. Check: already used ────────────────────────────────────────
  if (otpData.used) {
    return res.status(400).json({
      success: false,
      message: "This verification code has already been used. Please request a new code.",
    });
  }

  // ── 5. Check: expiration ──────────────────────────────────────────
  const now = Date.now();
  const expiresAtMs = otpData.expiresAt
    ? (otpData.expiresAt.toMillis ? otpData.expiresAt.toMillis() : otpData.expiresAt)
    : 0;

  if (now > expiresAtMs) {
    // Clean up expired document
    await otpRef.delete().catch(() => {});
    return res.status(400).json({
      success: false,
      message: "This verification code has expired. Please request a new code.",
    });
  }

  // ── 6. Check: attempt count ───────────────────────────────────────
  const currentAttempts = otpData.attempts || 0;
  const maxAttempts = otpData.maxAttempts || OTP_MAX_ATTEMPTS;

  if (currentAttempts >= maxAttempts) {
    // Invalidate the OTP document after max attempts
    await otpRef.delete().catch(() => {});
    return res.status(429).json({
      success: false,
      message: "Too many incorrect attempts. Please request a new verification code.",
    });
  }

  // ── 7. Verify OTP hash (timing-safe) ─────────────────────────────
  const submittedHash = hashOtp(otp);
  const storedHash = otpData.otpHash || "";

  if (!safeCompareHashes(submittedHash, storedHash)) {
    // Increment attempt counter
    const newAttempts = currentAttempts + 1;
    try {
      await otpRef.update({ attempts: newAttempts });
    } catch (updateErr) {
      console.error("[verifyOtp] Could not update attempt count:", updateErr);
    }

    const remainingAttempts = maxAttempts - newAttempts;

    if (remainingAttempts <= 0) {
      await otpRef.delete().catch(() => {});
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Please request a new verification code.",
      });
    }

    return res.status(400).json({
      success: false,
      message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
    });
  }

  // ── 8. OTP is correct — invalidate immediately (single-use) ──────
  try {
    await otpRef.update({ used: true });
  } catch (updateErr) {
    console.error("[verifyOtp] Could not mark OTP as used:", updateErr);
    // Non-fatal: continue with account creation but log for investigation
  }

  // ── 9. Create Firebase Authentication user ────────────────────────
  let firebaseUser;
  try {
    // Check if user already exists (avoids silent duplicates)
    try {
      const existingUser = await authAdmin.getUserByEmail(email);
      if (existingUser) {
        // Restore OTP to unused if we're going to reject (rollback)
        await otpRef.update({ used: false }).catch(() => {});
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists. Please sign in instead.",
        });
      }
    } catch (lookupErr) {
      // auth/user-not-found is expected — continue
      if (lookupErr.code !== "auth/user-not-found") {
        throw lookupErr;
      }
    }

    firebaseUser = await authAdmin.createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true, // OTP proves email ownership — mark as verified at creation
    });
  } catch (authErr) {
    console.error("[verifyOtp] Firebase Auth user creation error:", authErr.code, authErr.message);

    // Rollback: un-mark the OTP as used so the user can retry after fixing the error
    await otpRef.update({ used: false }).catch(() => {});

    if (authErr.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
      });
    }
    if (authErr.code === "auth/invalid-email") {
      return res.status(400).json({ success: false, message: "Invalid email address." });
    }
    if (authErr.code === "auth/weak-password") {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not create your account. Please try again later.",
    });
  }

  // ── 10. Save user profile in Firestore `customers` collection ─────
  const uid = firebaseUser.uid;
  try {
    await db.collection("customers").doc(uid).set({
      id: uid,
      name: fullName,
      email,
      phone: phoneNumber,
      emailVerified: true,
      isVerified: true,
      status: "Active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ordersCount: 0,
      totalSpent: 0,
    });
  } catch (firestoreErr) {
    console.error("[verifyOtp] Firestore customer doc creation error:", firestoreErr);
    // Compensating cleanup: delete the Firebase Auth user since profile save failed
    await authAdmin.deleteUser(uid).catch((delErr) => {
      console.error("[verifyOtp] Cleanup: could not delete orphaned Auth user:", delErr);
    });
    // Re-mark OTP as unused so user can retry
    await otpRef.update({ used: false }).catch(() => {});

    return res.status(500).json({
      success: false,
      message: "Account creation failed during profile setup. Please try again.",
    });
  }

  // ── 11. Clean up OTP document (optional — already marked used) ────
  // Defer deletion to keep an audit record; document is already marked used=true.
  // A TTL policy or scheduled Cloud Function can clean up later.

  // ── 12. Return safe session information — no secrets, no hashes ───
  return res.status(200).json({
    success: true,
    message: "Email verified successfully. Your account has been created.",
    user: {
      uid,
      name: fullName,
      email,
      phone: phoneNumber,
      emailVerified: true,
      isVerified: true,
    },
  });
};
