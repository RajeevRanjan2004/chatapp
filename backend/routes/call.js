const express = require("express");
const router = express.Router();
const CallLog = require("../models/CallLog");

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(req.user?.id || "") !== String(userId)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const logs = await CallLog.find({
      $or: [{ callerId: userId }, { receiverId: userId }],
    }).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.post("/", async (req, res) => {
  try {
    const { callerId, receiverId } = req.body || {};
    const currentUserId = String(req.user?.id || "");

    if (![String(callerId || ""), String(receiverId || "")].includes(currentUserId)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const log = new CallLog(req.body);
    await log.save();
    res.json(log);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;

