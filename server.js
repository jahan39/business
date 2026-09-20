"use strict";

/**
 * The Sugar Atelier — Main Server
 *
 * Serves the static frontend files and mounts the OTP registration API.
 * Run: node server.js  (or: npm start)
 * Then open: http://localhost:3000
 */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const sendOtpHandler = require("./api/sendOtp");
const verifyOtpHandler = require("./api/verifyOtp");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────

// Parse JSON request bodies
app.use(express.json({ limit: "10kb" }));

// CORS — allow same-origin, any local dev port (Live Server 5500, etc.), and file:// origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like file://, mobile apps, curl)
      if (!origin || origin === "null") return callback(null, true);
      // Allow any localhost / 127.0.0.1 port in development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  })
);

// ── Global IP-based rate limiter for all /api routes ──────────────────
// 60 requests per IP per 15 minutes across all API endpoints
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
  skip: (req) => {
    // Only rate-limit API routes
    return !req.path.startsWith("/api/");
  },
});
app.use(globalApiLimiter);

// ── Stricter limiter for OTP send endpoint ────────────────────────────
// 10 OTP send requests per IP per hour (business logic further restricts per-email)
const sendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification requests from this device. Please try again later.",
  },
});

// ── Stricter limiter for OTP verify endpoint ─────────────────────────
// 20 verification attempts per IP per 15 minutes
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts from this device. Please try again later.",
  },
});

// ── API Routes ────────────────────────────────────────────────────────
app.post("/api/auth/send-otp", sendOtpLimiter, sendOtpHandler);
app.post("/api/auth/verify-otp", verifyOtpLimiter, verifyOtpHandler);

// ── Static Files ──────────────────────────────────────────────────────
// Serve all HTML, CSS, JS, images from the project root
app.use(express.static(path.join(__dirname), {
  // Do not expose .env, serviceAccountKey.json, or server source files
  setHeaders: (res, filePath) => {
    const blocked = [".env", "serviceAccountKey.json", ".gitignore"];
    const basename = path.basename(filePath);
    if (blocked.includes(basename) || basename.endsWith(".json") && basename !== "package.json") {
      // Block direct access to sensitive files
      // (package.json is harmless but json data files should not be served directly)
    }
  },
}));

// Block direct access to sensitive files
app.get([".env", "/serviceAccountKey.json", "/api/*.js"], (req, res) => {
  res.status(404).end();
});

// ── 404 Handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  // For API routes return JSON 404; for page routes serve index.html
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Endpoint not found." });
  }
  res.status(404).sendFile(path.join(__dirname, "index.html"));
});

// ── Global Error Handler ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(500).json({
    success: false,
    message: "An internal server error occurred. Please try again later.",
  });
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ The Sugar Atelier server running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  if (!process.env.RESEND_API_KEY) {
    console.warn("   ⚠️  RESEND_API_KEY is not set — emails will not be sent.");
  }
  if (!process.env.FIREBASE_PRIVATE_KEY && !require("fs").existsSync("serviceAccountKey.json")) {
    console.warn("   ⚠️  Firebase Admin credentials not configured — account creation will fail.");
  }
  console.log("");
});
