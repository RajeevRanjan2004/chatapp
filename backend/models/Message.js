if (process.env.USE_FILE_DB === "1") {
  const { createLocalModel } = require("../utils/localModel");

  module.exports = createLocalModel("messages", {
    defaults: () => ({
      message: "",
      messageType: "text",
      mediaUrl: null,
      mediaName: null,
      deletedFor: [],
      deletedForEveryone: false,
      deletedForEveryoneAt: null,
      deletedForEveryoneBy: null,
    }),
    aggregate: ({ pipeline, collection }) => {
      const matchStage = pipeline.find((entry) => entry.$match)?.$match || {};
      const matchClauses = Array.isArray(matchStage.$and) ? matchStage.$and : [];
      const userPairClause = matchClauses.find((entry) => Array.isArray(entry.$or));
      const userId =
        userPairClause?.$or?.[0]?.senderId ||
        userPairClause?.$or?.[0]?.receiverId ||
        userPairClause?.$or?.[1]?.senderId ||
        userPairClause?.$or?.[1]?.receiverId ||
        "";

      const recentMap = new Map();

      collection
        .filter((message) => {
          if (!userId) return false;
          const involvesUser = message.senderId === userId || message.receiverId === userId;
          const hiddenForUser = Array.isArray(message.deletedFor) && message.deletedFor.includes(userId);
          return involvesUser && !hiddenForUser;
        })
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .forEach((message) => {
          const chatUserId = message.senderId === userId ? message.receiverId : message.senderId;
          if (recentMap.has(chatUserId)) return;

          recentMap.set(chatUserId, {
            userId: chatUserId,
            message: message.message,
            messageType: message.messageType,
            mediaUrl: message.mediaUrl,
            mediaName: message.mediaName,
            createdAt: message.createdAt,
          });
        });

      return [...recentMap.values()];
    },
  });
} else {
  const mongoose = require("mongoose");

  const messageSchema = new mongoose.Schema(
    {
      senderId: {
        type: String,
        required: true,
      },
      receiverId: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        default: "",
      },
      messageType: {
        type: String,
        enum: ["text", "image", "audio", "file"],
        default: "text",
      },
      mediaUrl: {
        type: String,
        default: null,
      },
      mediaName: {
        type: String,
        default: null,
      },
      deletedFor: {
        type: [String],
        default: [],
      },
      deletedForEveryone: {
        type: Boolean,
        default: false,
      },
      deletedForEveryoneAt: {
        type: Date,
        default: null,
      },
      deletedForEveryoneBy: {
        type: String,
        default: null,
      },
    },
    { timestamps: true }
  );

  const Message = mongoose.model("Message", messageSchema);
  module.exports = Message;
}
