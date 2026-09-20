"use strict";

/**
 * Firebase Admin SDK initializer (shared singleton).
 * Compatible with firebase-admin v14+ which uses named exports.
 *
 * Credentials are loaded from environment variables or from serviceAccountKey.json
 * in the project root. This module is ONLY imported server-side.
 *
 * NEVER expose the Admin SDK or serviceAccountKey.json to the browser/client.
 */

const {
  initializeApp,
  getApps,
  getApp,
  cert,
} = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

let _app = null;

function initAdmin() {
  // Return existing app if already initialised
  if (_app || getApps().length > 0) {
    _app = _app || getApp();
    return { app: _app, auth: getAuth(_app), db: getFirestore(_app) };
  }

  let credential;

  // Option A: Explicit env vars (recommended for cloud/production)
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    let rawKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
      rawKey = rawKey.substring(1, rawKey.length - 1);
    }
    const cleanKey = rawKey.replace(/\\n/g, "\n");

    credential = cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: cleanKey,
    });
  } else {
    // Option B: serviceAccountKey.json in project root (local development)
    const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
    if (fs.existsSync(keyPath)) {
      credential = cert(keyPath);
    } else {
      throw new Error(
        "Firebase Admin credentials not found. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env " +
        "or place serviceAccountKey.json in the project root."
      );
    }
  }

  _app = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });

  return { app: _app, auth: getAuth(_app), db: getFirestore(_app) };
}

module.exports = { initAdmin, FieldValue, Timestamp };
