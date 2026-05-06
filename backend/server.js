const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.join(__dirname, ".env") });

const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const Message = require("./models/Message");
const User = require("./models/User");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const userRoutes = require("./routes/user");
const callRoutes = require("./routes/call");
const statusRoutes = require("./routes/status");
const { requireAuth, verifyAuthToken } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const onlineUsers = new Map();
const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
const hasFrontendBuild = fs.existsSync(frontendDistPath);
const clientOriginEnv = process.env.CLIENT_ORIGIN || "";

const allowedOrigins = clientOriginEnv
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function isPrivateNetworkOrigin(origin) {
  return (
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
    /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
    origin === "capacitor://localhost" ||
    origin === "ionic://localhost"
  );
}

function isCapacitorLocalhostOrigin(origin) {
  return origin === "http://localhost" || origin === "https://localhost";
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes(origin)) return true;
  return /^http:\/\/localhost:\d+$/.test(origin) || isCapacitorLocalhostOrigin(origin);
}

function isLoopbackOrigin(origin) {
  return (
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
    /^http:\/\/\[::1\]:\d+$/.test(origin) ||
    origin === "http://127.0.0.1" ||
    origin === "https://127.0.0.1"
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin) || isLoopbackOrigin(origin) || isPrivateNetworkOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", requireAuth, chatRoutes);
app.use("/api/users", requireAuth, userRoutes);
app.use("/api/calls", requireAuth, callRoutes);
app.use("/api/status", requireAuth, statusRoutes);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin) || isLoopbackOrigin(origin) || isPrivateNetworkOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket CORS blocked origin: ${origin}`));
    },
    credentials: true,
  },
});

app.set("io", io);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const payload = verifyAuthToken(token);
    socket.data.userId = String(payload.id);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const socketUserId = socket.data.userId;
  if (!socketUserId) {
    socket.disconnect(true);
    return;
  }

  console.log("User connected:", socket.id, "as", socketUserId);
  socket.join(socketUserId);
  onlineUsers.set(socketUserId, socket.id);

  User.findByIdAndUpdate(socketUserId, {
    isOnline: true,
    lastSeen: new Date(),
  }).catch((error) => {
    console.log("Presence update error:", error);
  });

  io.emit("userOnline", { userId: socketUserId, isOnline: true });

  socket.on("sendMessage", async (payload) => {
    try {
      const { receiverId, message, messageType = "text", mediaUrl = null, mediaName = null } = payload || {};
      if (!receiverId) return;
      if (!message && !mediaUrl) return;

      const newMessage = new Message({
        senderId: socketUserId,
        receiverId,
        message,
        messageType,
        mediaUrl,
        mediaName,
      });

      await newMessage.save();

      const eventPayload = {
        senderId: socketUserId,
        receiverId,
        message,
        messageType,
        mediaUrl,
        mediaName,
        createdAt: newMessage.createdAt,
        _id: newMessage._id,
      };

      io.to(receiverId).emit("receiveMessage", eventPayload);
      io.to(socketUserId).emit("receiveMessage", eventPayload);
    } catch (error) {
      console.log("Message error:", error);
    }
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    if (senderId !== socketUserId || !receiverId) return;
    io.to(receiverId).emit("userTyping", { senderId: socketUserId, isTyping: true });
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    if (senderId !== socketUserId || !receiverId) return;
    io.to(receiverId).emit("userTyping", { senderId: socketUserId, isTyping: false });
  });

  socket.on("call:start", ({ callerId, receiverId, callType = "voice" }) => {
    if (callerId !== socketUserId || !receiverId) return;
    io.to(receiverId).emit("call:incoming", { callerId: socketUserId, receiverId, callType });
  });

  socket.on("call:accept", ({ callerId, receiverId }) => {
    if (receiverId !== socketUserId || !callerId) return;
    io.to(callerId).emit("call:accepted", { callerId, receiverId: socketUserId });
  });

  socket.on("call:reject", ({ callerId, receiverId }) => {
    if (receiverId !== socketUserId || !callerId) return;
    io.to(callerId).emit("call:rejected", { callerId, receiverId: socketUserId });
  });

  socket.on("call:end", ({ callerId, receiverId, durationSec = 0 }) => {
    if (!callerId || !receiverId) return;
    if (![callerId, receiverId].includes(socketUserId)) return;

    const payload = { callerId, receiverId, durationSec };
    io.to(callerId).emit("call:ended", payload);
    io.to(receiverId).emit("call:ended", payload);
  });

  socket.on("call:signal", ({ toUserId, fromUserId, data }) => {
    if (fromUserId !== socketUserId || !toUserId || !data) return;
    io.to(toUserId).emit("call:signal", { fromUserId: socketUserId, data });
  });

  socket.on("disconnect", async () => {
    onlineUsers.delete(socketUserId);

    try {
      await User.findByIdAndUpdate(socketUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      io.emit("userOffline", { userId: socketUserId, isOnline: false });
    } catch (error) {
      console.log("Disconnect presence error:", error);
    }

    console.log("User disconnected:", socket.id);
  });
});

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api|socket\.io|health).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("WhatsApp Clone Backend Running");
  });
}

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
