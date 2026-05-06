const express = require("express");
const Status = require("../models/Status");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    await Status.deleteMany({ expiresAt: { $lte: now } });

    const statuses = await Status.find({
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(statuses);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, text = "", mediaUrl = null, mediaType = "text" } = req.body || {};

    if (!userId) {
      return res.status(400).json({ msg: "User is required" });
    }

    if (String(req.user?.id || "") !== String(userId)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({ msg: "Status text or media is required" });
    }

    const status = new Status({
      userId,
      text,
      mediaUrl,
      mediaType,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await status.save();
    req.app.get("io")?.emit("status:new", status);
    res.json(status);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
