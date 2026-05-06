const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Message = require("../models/Message");
const {
  buildInternalEmail,
  getPhoneNumberVariants,
  isValidPhoneNumber,
  isInternalEmail,
  isInternalPhoneNumber,
  looksLikeEmail,
  normalizePhoneNumber,
  sanitizeUser,
} = require("../utils/identity");

function isSelfRequest(req, userId) {
  return String(req.user?.id || "") === String(userId || "");
}

// Get all users
router.get("/", async (req, res) => {
  try {
    const viewerId = req.query.viewerId;
    const users = await User.find().select("-password");
    const mapped = users.map((u) => {
      const obj = sanitizeUser(u);
      if (obj.privacyLastSeen === "none" && viewerId && viewerId !== String(obj._id)) {
        obj.lastSeen = null;
      }
      return obj;
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Get user profile by ID
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(sanitizeUser(user));
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Update user profile
router.put("/:id", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.id)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const { name, statusMessage, profilePic, privacyLastSeen, phoneNumber, email } = req.body;
    
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (statusMessage !== undefined) user.statusMessage = statusMessage;
    if (profilePic !== undefined) user.profilePic = profilePic;

    if (phoneNumber !== undefined) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      if (!isValidPhoneNumber(normalizedPhone)) {
        return res.status(400).json({ msg: "Valid mobile number is required" });
      }

      const existingPhoneUser = await User.findOne({
        _id: { $ne: req.params.id },
        phoneNumber: { $in: getPhoneNumberVariants(normalizedPhone) },
      });
      if (existingPhoneUser) {
        return res.status(400).json({ msg: "Mobile number already in use" });
      }

      user.phoneNumber = normalizedPhone;

      if (isInternalEmail(user.email)) {
        user.email = buildInternalEmail(normalizedPhone);
      }
    }

    if (email !== undefined) {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (normalizedEmail && !looksLikeEmail(normalizedEmail)) {
        return res.status(400).json({ msg: "Invalid email address" });
      }

      if (normalizedEmail) {
        const existingEmailUser = await User.findOne({
          _id: { $ne: req.params.id },
          email: normalizedEmail,
        });
        if (existingEmailUser) {
          return res.status(400).json({ msg: "Email already in use" });
        }
      }

      if (!normalizedEmail && (!user.phoneNumber || isInternalPhoneNumber(user.phoneNumber))) {
        return res.status(400).json({ msg: "Email is required for this account" });
      }

      user.email = normalizedEmail || buildInternalEmail(user.phoneNumber);
    }

    if (privacyLastSeen === "all" || privacyLastSeen === "none") {
      user.privacyLastSeen = privacyLastSeen;
    }

    await user.save();
    res.json({ msg: "Profile updated", user: sanitizeUser(user) });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

// Block a contact
router.put("/:id/block/:contactId", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.id)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (!user.blockedContacts.includes(req.params.contactId)) {
      user.blockedContacts.push(req.params.contactId);
      await user.save();
    }
    res.json({ blockedContacts: user.blockedContacts });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Unblock a contact
router.put("/:id/unblock/:contactId", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.id)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.blockedContacts = user.blockedContacts.filter((id) => id !== req.params.contactId);
    await user.save();
    res.json({ blockedContacts: user.blockedContacts });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Change password (simple)
router.put("/:id/password", async (req, res) => {
  res.status(410).json({ msg: "Password login is disabled. Use email OTP instead." });
});

// Delete account + messages
router.delete("/:id", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.id)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const messages = await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    await User.deleteOne({ _id: userId });

    res.json({ msg: "Account deleted", deletedMessages: messages.deletedCount });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
