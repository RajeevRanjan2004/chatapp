if (process.env.USE_FILE_DB === "1") {
  const { createLocalModel } = require("../utils/localModel");

  module.exports = createLocalModel("callLogs", {
    defaults: () => ({
      type: "voice",
      status: "ended",
      durationSec: 0,
    }),
  });
} else {
  const mongoose = require("mongoose");

  const callLogSchema = new mongoose.Schema(
    {
      callerId: { type: String, required: true },
      receiverId: { type: String, required: true },
      type: { type: String, enum: ["voice", "video"], default: "voice" },
      status: { type: String, enum: ["missed", "answered", "ended"], default: "ended" },
      durationSec: { type: Number, default: 0 },
    },
    { timestamps: true }
  );

  module.exports = mongoose.model("CallLog", callLogSchema);
}

