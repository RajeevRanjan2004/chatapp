const express = require("express");
const Message = require("../models/Message");

const router = express.Router();

function isSelfRequest(req, userId) {
  return String(req.user?.id || "") === String(userId || "");
}

function serializeMessage(message) {
  if (!message) return message;

  return {
    _id: message._id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    message: message.message,
    messageType: message.messageType,
    mediaUrl: message.mediaUrl,
    mediaName: message.mediaName,
    deletedFor: message.deletedFor || [],
    deletedForEveryone: !!message.deletedForEveryone,
    deletedForEveryoneAt: message.deletedForEveryoneAt,
    deletedForEveryoneBy: message.deletedForEveryoneBy,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

router.get("/recent/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isSelfRequest(req, userId)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const recent = await Message.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [{ senderId: userId }, { receiverId: userId }],
            },
            {
              deletedFor: { $ne: userId },
            },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          chatUserId: {
            $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"],
          },
        },
      },
      {
        $group: {
          _id: "$chatUserId",
          message: { $first: "$message" },
          messageType: { $first: "$messageType" },
          mediaUrl: { $first: "$mediaUrl" },
          mediaName: { $first: "$mediaName" },
          createdAt: { $first: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          message: 1,
          messageType: 1,
          mediaUrl: 1,
          mediaName: 1,
          createdAt: 1,
        },
      },
    ]);

    res.json(recent);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.get("/:user1/:user2", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.user1)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const messages = await Message.find({
      $and: [
        {
          $or: [
            { senderId: req.params.user1, receiverId: req.params.user2 },
            { senderId: req.params.user2, receiverId: req.params.user1 },
          ],
        },
        {
          deletedFor: { $ne: req.params.user1 },
        },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.put("/message/:messageId/delete-for-me", async (req, res) => {
  try {
    const currentUserId = String(req.user?.id || "");
    const { messageId } = req.params;

    if (!currentUserId) {
      return res.status(400).json({ msg: "User is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ msg: "Message not found" });
    }

    if (![message.senderId, message.receiverId].includes(currentUserId)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    if (!message.deletedFor.includes(currentUserId)) {
      message.deletedFor.push(currentUserId);
      await message.save();
    }

    req.app.get("io")?.to(currentUserId).emit("message:deleted-for-me", {
      messageId: String(message._id),
      userId: currentUserId,
      otherUserId: message.senderId === currentUserId ? message.receiverId : message.senderId,
    });

    res.json({
      msg: "Message deleted for you",
      messageId: String(message._id),
      userId: currentUserId,
    });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.put("/message/:messageId/delete-for-everyone", async (req, res) => {
  try {
    const currentUserId = String(req.user?.id || "");
    const { messageId } = req.params;

    if (!currentUserId) {
      return res.status(400).json({ msg: "User is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ msg: "Message not found" });
    }

    if (message.senderId !== currentUserId) {
      return res.status(403).json({ msg: "Only sender can delete for everyone" });
    }

    message.message = "This message was deleted";
    message.messageType = "text";
    message.mediaUrl = null;
    message.mediaName = null;
    message.deletedForEveryone = true;
    message.deletedForEveryoneAt = new Date();
    message.deletedForEveryoneBy = currentUserId;
    await message.save();

    const serialized = serializeMessage(message);
    req.app.get("io")?.to(message.senderId).emit("message:updated", serialized);
    req.app.get("io")?.to(message.receiverId).emit("message:updated", serialized);

    res.json({
      msg: "Message deleted for everyone",
      message: serialized,
    });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

router.delete("/:user1/:user2", async (req, res) => {
  try {
    if (!isSelfRequest(req, req.params.user1)) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const result = await Message.deleteMany({
      $or: [
        { senderId: req.params.user1, receiverId: req.params.user2 },
        { senderId: req.params.user2, receiverId: req.params.user1 },
      ],
    });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
