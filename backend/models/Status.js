if (process.env.USE_FILE_DB === "1") {
  const { createLocalModel } = require("../utils/localModel");

  module.exports = createLocalModel("statuses", {
    defaults: () => ({
      text: "",
      mediaUrl: null,
      mediaType: "text",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
} else {
  const mongoose = require("mongoose");

  const statusSchema = new mongoose.Schema(
    {
      userId: { type: String, required: true },
      text: { type: String, default: "" },
      mediaUrl: { type: String, default: null },
      mediaType: { type: String, enum: ["text", "image"], default: "text" },
      expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        index: { expires: 0 },
      },
    },
    { timestamps: true }
  );

  module.exports = mongoose.model("Status", statusSchema);
}

