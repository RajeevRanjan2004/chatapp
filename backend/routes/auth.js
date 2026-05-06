const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { buildInternalPhone, looksLikeEmail, normalizeEmail, sanitizeUser } = require("../utils/identity");
const { OtpError, requestOtpCode, verifyOtpCode } = require("../utils/otpProvider");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function findUserByEmail(email) {
  return User.findOne({ email: normalizeEmail(email) });
}

router.post("/request-otp", async (req, res) => {
  try {
    const { email, mode = "login", name = "" } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = String(name || "").trim();

    if (!looksLikeEmail(normalizedEmail)) {
      return res.status(400).json({ msg: "Valid email is required" });
    }

    if (!["auto", "login", "signup"].includes(mode)) {
      return res.status(400).json({ msg: "Invalid OTP mode" });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    const resolvedMode = mode === "auto" ? (existingUser ? "login" : "signup") : mode;

    if (resolvedMode === "login" && !existingUser) {
      return res.status(400).json({ msg: "No account found for this email" });
    }

    if (resolvedMode === "signup" && existingUser) {
      return res.status(400).json({ msg: "User already exists with this email" });
    }

    const otpResponse = await requestOtpCode({
      email: normalizedEmail,
      mode: resolvedMode,
      name: trimmedName,
    });

    res.json({
      ...otpResponse,
      mode: resolvedMode,
      isNewUser: resolvedMode === "signup",
      requiresName: resolvedMode === "signup",
    });
  } catch (err) {
    if (err instanceof OtpError || err?.statusCode) {
      return res.status(err.statusCode || 400).json({ msg: err.message });
    }
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, mode = "login", name = "" } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedOtp = String(otp || "").trim();
    const trimmedName = String(name || "").trim();

    if (!looksLikeEmail(normalizedEmail)) {
      return res.status(400).json({ msg: "Valid email is required" });
    }

    if (!["auto", "login", "signup"].includes(mode)) {
      return res.status(400).json({ msg: "Invalid OTP mode" });
    }

    const existingUser = await findUserByEmail(normalizedEmail);
    const resolvedMode = mode === "auto" ? (existingUser ? "login" : "signup") : mode;

    await verifyOtpCode({
      email: normalizedEmail,
      otp: trimmedOtp,
      mode: resolvedMode,
    });

    let user = await findUserByEmail(normalizedEmail);

    if (resolvedMode === "signup") {
      if (user) {
        return res.status(400).json({ msg: "User already exists with this email" });
      }

      if (!trimmedName) {
        return res.status(400).json({ msg: "Name is required for new accounts" });
      }

      const seedPassword = `otp-${Date.now()}-${Math.random()}`;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(seedPassword, salt);

      user = new User({
        name: trimmedName || "User",
        email: normalizedEmail,
        phoneNumber: buildInternalPhone(normalizedEmail),
        password: hashedPassword,
      });

      await user.save();
    }

    if (!user) {
      return res.status(400).json({ msg: "No account found for this email" });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    if (err instanceof OtpError || err?.statusCode) {
      return res.status(err.statusCode || 400).json({ msg: err.message });
    }
    console.log(err);
    res.status(500).send("Server error");
  }
});

router.post("/signup", (req, res) => {
  res.status(410).json({ msg: "Password signup is disabled. Use email OTP instead." });
});

router.post("/login", (req, res) => {
  res.status(410).json({ msg: "Password login is disabled. Use email OTP instead." });
});

module.exports = router;
