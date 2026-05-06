if (process.env.USE_FILE_DB === "1") {
  const { createLocalModel, nowIso } = require("../utils/localModel");

  module.exports = createLocalModel("users", {
    defaults: () => ({
      profilePic: null,
      statusMessage: "Hey there! I'm using Chat App",
      isOnline: false,
      lastSeen: nowIso(),
      privacyLastSeen: "all",
      blockedContacts: [],
    }),
  });
} else {
  const mongoose = require("mongoose");

  const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
    },

    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
    },

    profilePic: {
      type: String,
      default: null,
    },

    statusMessage: {
      type: String,
      default: "Hey there! I'm using Chat App",
      maxlength: 139,
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },
    privacyLastSeen: {
      type: String,
      enum: ["all", "none"],
      default: "all",
    },
    blockedContacts: {
      type: [String],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  }, { timestamps: true });

  const User = mongoose.model("User", userSchema);

  module.exports = User;
}
