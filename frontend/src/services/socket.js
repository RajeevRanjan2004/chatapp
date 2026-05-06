import io from "socket.io-client";
import { getSocketBaseUrl } from "../utils/platform";

let socket = null;

export const socketService = {
  connect: (token) => {
    const socketUrl = getSocketBaseUrl();

    if (socket?.connected && socket.io?.uri === socketUrl) return socket;
    if (socket && socket.io?.uri !== socketUrl) {
      socket.disconnect();
      socket = null;
    }

    // Don't force websocket-only; allow polling fallback (more reliable on Windows/proxies)
    socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : undefined,
    });

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error:', socketUrl, err?.message || err);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  sendMessage: (payload) => {
    if (socket) {
      socket.emit('sendMessage', payload);
    }
  },

  onReceiveMessage: (callback) => {
    if (socket) {
      socket.on("receiveMessage", callback);
      return () => socket?.off("receiveMessage", callback);
    }
    return () => {};
  },

  onMessageUpdated: (callback) => {
    if (socket) {
      socket.on("message:updated", callback);
      return () => socket?.off("message:updated", callback);
    }
    return () => {};
  },

  onMessageDeletedForMe: (callback) => {
    if (socket) {
      socket.on("message:deleted-for-me", callback);
      return () => socket?.off("message:deleted-for-me", callback);
    }
    return () => {};
  },

  onStatusNew: (callback) => {
    if (socket) {
      socket.on("status:new", callback);
      return () => socket?.off("status:new", callback);
    }
    return () => {};
  },

  // Typing indicators
  sendTyping: (senderId, receiverId) => {
    if (socket) {
      socket.emit('typing', { senderId, receiverId });
    }
  },

  stopTyping: (senderId, receiverId) => {
    if (socket) {
      socket.emit('stopTyping', { senderId, receiverId });
    }
  },

  onUserTyping: (callback) => {
    if (socket) {
      socket.on('userTyping', callback);
      return () => socket?.off('userTyping', callback);
    }
    return () => {};
  },

  // Online status
  onUserOnline: (callback) => {
    if (socket) {
      socket.on('userOnline', callback);
      return () => socket?.off('userOnline', callback);
    }
    return () => {};
  },

  onUserOffline: (callback) => {
    if (socket) {
      socket.on('userOffline', callback);
      return () => socket?.off('userOffline', callback);
    }
    return () => {};
  },

  startCall: (payload) => socket?.emit('call:start', payload),
  acceptCall: (payload) => socket?.emit('call:accept', payload),
  rejectCall: (payload) => socket?.emit('call:reject', payload),
  endCall: (payload) => socket?.emit('call:end', payload),

  onIncomingCall: (callback) => {
    if (socket) {
      socket.on('call:incoming', callback);
      return () => socket?.off('call:incoming', callback);
    }
    return () => {};
  },
  onCallAccepted: (callback) => {
    if (socket) {
      socket.on('call:accepted', callback);
      return () => socket?.off('call:accepted', callback);
    }
    return () => {};
  },
  onCallRejected: (callback) => {
    if (socket) {
      socket.on('call:rejected', callback);
      return () => socket?.off('call:rejected', callback);
    }
    return () => {};
  },
  onCallEnded: (callback) => {
    if (socket) {
      socket.on('call:ended', callback);
      return () => socket?.off('call:ended', callback);
    }
    return () => {};
  },
  sendCallSignal: (payload) => socket?.emit('call:signal', payload),
  onCallSignal: (callback) => {
    if (socket) {
      socket.on('call:signal', callback);
      return () => socket?.off('call:signal', callback);
    }
    return () => {};
  },

  getSocket: () => socket,
};
