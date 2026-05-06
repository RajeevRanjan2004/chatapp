import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { callService, chatService, statusService, userService } from "../services/api";
import { socketService } from "../services/socket";
import ChatWindow from "../components/ChatWindow";
import Avatar from "../components/Avatar";
import ProfileModal from "../components/ProfileModal";
import SettingsModal from "../components/SettingsModal";
import SearchAndFilter from "../components/SearchAndFilter";
import ChatOptions from "../components/ChatOptions";
import CallHistoryList from "../components/CallHistoryList";
import StatusList from "../components/StatusList";
import Icon from "../components/Icon";
import { formatDuration, formatLastSeen, formatLongDateTime } from "../utils/formatters";
import { isAndroidApp, isNativeApp } from "../utils/platform";
import { isEnterToSendEnabled, readChatSettings } from "../utils/chatSettings";
import {
  consumePendingChatUserId,
  isAppForeground,
  requestNativeNotificationPermission,
  setNativeBackHandler,
  setNotificationTapHandler,
  showIncomingMessageNotification,
} from "../services/nativeShell";

function readStoredIds(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key, ids) {
  localStorage.setItem(key, JSON.stringify(ids));
}

function mergeUsersWithRecent(baseUsers, recentItems) {
  const recentMap = new Map((recentItems || []).map((item) => [item.userId, item]));

  return [...baseUsers]
    .map((candidate) => {
      const recent = recentMap.get(candidate._id);
      if (!recent) return candidate;

      return {
        ...candidate,
        lastMessage: recent.message,
        lastMessageType: recent.messageType,
        lastMediaName: recent.mediaName,
        lastMessageAt: recent.createdAt,
      };
    })
    .sort((left, right) => new Date(right.lastMessageAt || 0) - new Date(left.lastMessageAt || 0));
}

function upsertStatus(list, nextStatus) {
  if (!nextStatus?._id) return list;
  const existingIndex = list.findIndex((item) => item._id === nextStatus._id);
  if (existingIndex === -1) {
    return [nextStatus, ...list];
  }

  const nextList = [...list];
  nextList[existingIndex] = nextStatus;
  return nextList;
}

export default function Chat() {
  const { user, token, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [callHistory, setCallHistory] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [ongoingCall, setOngoingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [blockedIds, setBlockedIds] = useState(() => readStoredIds("blockedContacts"));
  const [mutedIds, setMutedIds] = useState(() => readStoredIds("mutedChats"));
  const [callElapsed, setCallElapsed] = useState(0);
  const [pendingChatUserId, setPendingChatUserId] = useState(() => consumePendingChatUserId());

  const typingTimeoutRef = useRef(null);
  const selectedUserRef = useRef(null);
  const usersRef = useRef(users);
  const blockedRef = useRef(blockedIds);
  const mutedRef = useRef(mutedIds);
  const pcRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const refreshRecentChats = async (baseUsers = null) => {
    if (!user?._id) return;

    try {
      const recentResponse = await chatService.getRecentChats(user._id);
      if (baseUsers) {
        setUsers(mergeUsersWithRecent(baseUsers, recentResponse.data || []));
        return;
      }

      setUsers((currentUsers) => mergeUsersWithRecent(currentUsers, recentResponse.data || []));
    } catch (error) {
      console.error("Error refreshing recent chats:", error);
    }
  };

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    blockedRef.current = blockedIds;
    writeStoredIds("blockedContacts", blockedIds);
  }, [blockedIds]);

  useEffect(() => {
    writeStoredIds("mutedChats", mutedIds);
    mutedRef.current = mutedIds;
  }, [mutedIds]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const filtered = users.filter((candidate) => {
      if (blockedIds.includes(candidate._id)) return false;

      const matchesSearch =
        candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (candidate.phoneNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (candidate.email || "").toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (filterType === "online" && !candidate.isOnline) return false;
      if (filterType === "offline" && candidate.isOnline) return false;

      return true;
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterType, blockedIds]);

  useEffect(() => {
    if (!selectedUser) return;

    const refreshed = users.find((candidate) => candidate._id === selectedUser._id);
    if (refreshed) {
      setSelectedUser((current) => (current ? { ...current, ...refreshed } : current));
    }
  }, [users]);

  useEffect(() => {
    if (!ongoingCall?.startedAt || ongoingCall.ring) {
      setCallElapsed(0);
      return undefined;
    }

    setCallElapsed(Math.floor((Date.now() - ongoingCall.startedAt) / 1000));
    const interval = setInterval(() => {
      setCallElapsed(Math.floor((Date.now() - ongoingCall.startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [ongoingCall?.startedAt, ongoingCall?.ring]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return undefined;
    }

    const fetchSidebarData = async () => {
      try {
        const [userResponse, recentResponse] = await Promise.all([
          userService.getAllUsers(user._id),
          chatService.getRecentChats(user._id),
        ]);

        const withoutSelf = userResponse.data.filter((candidate) => candidate._id !== user._id);
        setUsers(mergeUsersWithRecent(withoutSelf, recentResponse.data));

        const [callResponse, statusResponse] = await Promise.all([
          callService.getCallHistory(user._id),
          statusService.getStatuses(),
        ]);

        setCallHistory((callResponse.data || []).map((entry) => ({ ...entry, currentUserId: user._id })));
        setStatuses(statusResponse.data || []);
      } catch (err) {
        console.error("Error fetching chat data:", err);
      }
    };

    fetchSidebarData();
    socketService.connect(token);

    const offReceive = socketService.onReceiveMessage((payload) => {
      const activeChat = selectedUserRef.current;
      const chatUserId = payload.senderId === user._id ? payload.receiverId : payload.senderId;
      const sender = usersRef.current.find((candidate) => candidate._id === payload.senderId);
      const notificationSettings = readChatSettings();

      setUsers((currentUsers) =>
        mergeUsersWithRecent(currentUsers, [
          {
            userId: chatUserId,
            message: payload.message,
            messageType: payload.messageType,
            mediaName: payload.mediaName,
            createdAt: payload.createdAt,
          },
        ])
      );

      if (
        payload.senderId !== user._id &&
        !blockedRef.current.includes(payload.senderId) &&
        !mutedRef.current.includes(payload.senderId) &&
        notificationSettings.notifyMessages &&
        !isAppForeground()
      ) {
        const previewMessage = notificationSettings.notifyPreview
          ? payload.message
          : "Open the app to read the latest message.";

        void showIncomingMessageNotification({
          senderId: payload.senderId,
          senderName: sender?.name || "New message",
          messageType: notificationSettings.notifyPreview ? payload.messageType : "text",
          message: previewMessage,
          mediaName: notificationSettings.notifyPreview ? payload.mediaName : "",
        });
      }

      if (
        activeChat &&
        ((payload.senderId === activeChat._id && payload.receiverId === user._id) ||
          (payload.senderId === user._id && payload.receiverId === activeChat._id))
      ) {
        setMessages((currentMessages) => {
          if (currentMessages.some((message) => message._id === payload._id)) {
            return currentMessages;
          }
          return [...currentMessages, payload];
        });
      }
    });

    const offMessageUpdated = socketService.onMessageUpdated((payload) => {
      const chatUserId = payload.senderId === user._id ? payload.receiverId : payload.senderId;

      setMessages((currentMessages) =>
        currentMessages.map((message) => (message._id === payload._id ? { ...message, ...payload } : message))
      );

      setUsers((currentUsers) =>
        mergeUsersWithRecent(currentUsers, [
          {
            userId: chatUserId,
            message: payload.message,
            messageType: payload.messageType,
            mediaName: payload.mediaName,
            createdAt: payload.createdAt,
          },
        ])
      );
    });

    const offMessageDeletedForMe = socketService.onMessageDeletedForMe((payload) => {
      if (payload.userId !== user._id) return;

      setMessages((currentMessages) =>
        currentMessages.filter((message) => String(message._id) !== String(payload.messageId))
      );
      refreshRecentChats();
    });

    const offTyping = socketService.onUserTyping((payload) => {
      if (selectedUserRef.current?._id === payload.senderId) {
        setIsTyping(payload.isTyping);
      }
    });

    const updatePresence = (payload) => {
      setUsers((currentUsers) =>
        currentUsers.map((candidate) =>
          candidate._id === payload.userId ? { ...candidate, isOnline: payload.isOnline } : candidate
        )
      );

      if (selectedUserRef.current?._id === payload.userId) {
        setSelectedUser((current) => (current ? { ...current, isOnline: payload.isOnline } : current));
      }
    };

    const offOnline = socketService.onUserOnline(updatePresence);
    const offOffline = socketService.onUserOffline(updatePresence);
    const offStatusNew = socketService.onStatusNew((payload) => {
      setStatuses((currentStatuses) => upsertStatus(currentStatuses, payload));
    });

    const offIncomingCall = socketService.onIncomingCall((payload) => {
      if (payload.receiverId === user._id) {
        setIncomingCall(payload);
      }
    });

    const offCallAccepted = socketService.onCallAccepted((payload) => {
      if (payload.callerId === user._id) {
        setOngoingCall((current) => ({
          ...current,
          ...payload,
          ring: false,
          startedAt: Date.now(),
        }));
      }
    });

    const offCallRejected = socketService.onCallRejected(() => {
      setOngoingCall(null);
      cleanupCallMedia();
      alert("Call rejected.");
    });

    const offCallEnded = socketService.onCallEnded(() => {
      setOngoingCall(null);
      setIncomingCall(null);
      cleanupCallMedia();
    });

    const offCallSignal = socketService.onCallSignal(async ({ fromUserId, data }) => {
      try {
        if (data?.type === "offer") {
          const stream = await ensureLocalStream(false);
          const peerConnection = await setupPeerConnection(fromUserId, stream);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          await flushPendingCandidates(peerConnection);

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          socketService.sendCallSignal({
            toUserId: fromUserId,
            fromUserId: user._id,
            data: { type: "answer", answer },
          });
        } else if (data?.type === "answer") {
          if (!pcRef.current) return;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushPendingCandidates(pcRef.current);
        } else if (data?.type === "ice-candidate") {
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            pendingCandidatesRef.current.push(data.candidate);
          }
        }
      } catch (error) {
        console.error("WebRTC signal error:", error);
      }
    });

    return () => {
      offReceive?.();
      offMessageUpdated?.();
      offMessageDeletedForMe?.();
      offTyping?.();
      offOnline?.();
      offOffline?.();
      offStatusNew?.();
      offIncomingCall?.();
      offCallAccepted?.();
      offCallRejected?.();
      offCallEnded?.();
      offCallSignal?.();
      cleanupCallMedia();
      socketService.disconnect();
    };
  }, [user, token, navigate]);

  const handleSelectUser = async (nextUser) => {
    if (blockedRef.current.includes(nextUser._id)) {
      alert("This contact is blocked.");
      return;
    }

    setSelectedUser(nextUser);
    setShowChatOptions(false);
    setShowMenu(false);
    setIsTyping(false);
    setLoading(true);

    try {
      const response = await chatService.getMessages(user._id, nextUser._id);
      setMessages(response.data || []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageChange = (event) => {
    const nextValue = event.target.value;
    setNewMessage(nextValue);

    if (!selectedUser) return;

    socketService.sendTyping(user._id, selectedUser._id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(user._id, selectedUser._id);
    }, 1000);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUser) return;
    if (blockedRef.current.includes(selectedUser._id)) {
      alert("You blocked this contact. Unblock them before sending messages.");
      return;
    }

    socketService.sendMessage({
      senderId: user._id,
      receiverId: selectedUser._id,
      message: newMessage.trim(),
      messageType: "text",
    });

    setNewMessage("");
    socketService.stopTyping(user._id, selectedUser._id);
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSendMedia = async (event, messageType) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedUser) return;

    try {
      setUploading(true);
      const mediaUrl = await fileToDataUrl(file);

      socketService.sendMessage({
        senderId: user._id,
        receiverId: selectedUser._id,
        message: file.name,
        messageType,
        mediaUrl,
        mediaName: file.name,
      });
    } catch (error) {
      alert("Failed to send media.");
    } finally {
      setUploading(false);
    }
  };

  const handleStartCall = async () => {
    if (!selectedUser) return;

    try {
      const stream = await ensureLocalStream(false);
      const peerConnection = await setupPeerConnection(selectedUser._id, stream);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socketService.sendCallSignal({
        toUserId: selectedUser._id,
        fromUserId: user._id,
        data: { type: "offer", offer },
      });
    } catch (error) {
      alert("Call start failed. Please allow microphone access.");
      return;
    }

    socketService.startCall({ callerId: user._id, receiverId: selectedUser._id, callType: "voice" });
    setOngoingCall({ callerId: user._id, receiverId: selectedUser._id, ring: true, startedAt: null });
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    try {
      await ensureLocalStream(false);
      socketService.acceptCall({ callerId: incomingCall.callerId, receiverId: user._id });
      setOngoingCall({ ...incomingCall, ring: false, startedAt: Date.now() });
      setIncomingCall(null);

      await callService.createCallLog({
        callerId: incomingCall.callerId,
        receiverId: user._id,
        type: incomingCall.callType || "voice",
        status: "answered",
        durationSec: 0,
      });
    } catch {
      alert("Could not access the microphone.");
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;

    socketService.rejectCall({ callerId: incomingCall.callerId, receiverId: user._id });
    await callService.createCallLog({
      callerId: incomingCall.callerId,
      receiverId: user._id,
      type: incomingCall.callType || "voice",
      status: "missed",
      durationSec: 0,
    });
    setIncomingCall(null);
  };

  const handleEndCall = async () => {
    if (!ongoingCall) return;

    const durationSec = ongoingCall.startedAt
      ? Math.floor((Date.now() - ongoingCall.startedAt) / 1000)
      : 0;

    socketService.endCall({
      callerId: ongoingCall.callerId || user._id,
      receiverId: ongoingCall.receiverId || selectedUser?._id,
      durationSec,
    });

    await callService.createCallLog({
      callerId: ongoingCall.callerId || user._id,
      receiverId: ongoingCall.receiverId || selectedUser?._id,
      type: "voice",
      status: "ended",
      durationSec,
    });

    setCallHistory((current) => [
      {
        _id: `tmp-${Date.now()}`,
        callerId: ongoingCall.callerId || user._id,
        receiverId: ongoingCall.receiverId || selectedUser?._id,
        type: "voice",
        status: "ended",
        durationSec,
        createdAt: new Date().toISOString(),
        currentUserId: user._id,
      },
      ...current,
    ]);

    setOngoingCall(null);
    cleanupCallMedia();
  };

  const handlePostStatus = async (mediaType = "text", mediaUrl = null, text = statusText) => {
    if (!text && !mediaUrl) return;

    try {
      const response = await statusService.createStatus({ userId: user._id, text, mediaUrl, mediaType });
      setStatuses((current) => upsertStatus(current, response.data));
      setStatusText("");
    } catch (error) {
      alert("Could not post the status.");
    }
  };

  const handleStatusImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const mediaUrl = await fileToDataUrl(file);
      await handlePostStatus("image", mediaUrl, statusText || file.name);
    } catch {
      alert("Could not upload the status image.");
    }
  };

  const openChatByUserId = async (nextUserId) => {
    if (!nextUserId) return;

    const match = usersRef.current.find((candidate) => String(candidate._id) === String(nextUserId));
    if (!match) return;

    setSidebarTab("chats");
    await handleSelectUser(match);
  };

  const handleLogout = () => {
    logout();
    socketService.disconnect();
    navigate("/");
  };

  const handleProfileClick = (nextProfileUser) => {
    setProfileUser(nextProfileUser);
    setShowProfileModal(true);
    setShowMenu(false);
  };

  const handleProfileUpdate = (updatedUser) => {
    setUsers((currentUsers) => currentUsers.map((candidate) => (candidate._id === updatedUser._id ? updatedUser : candidate)));

    if (selectedUser?._id === updatedUser._id) {
      setSelectedUser(updatedUser);
    }

    if (user?._id === updatedUser._id) {
      updateUser(updatedUser);
    }

    setProfileUser(updatedUser);
  };

  const handleBlockedChange = (nextIds) => {
    setBlockedIds(nextIds);

    if (selectedUser && nextIds.includes(selectedUser._id)) {
      setSelectedUser(null);
      setMessages([]);
      setShowChatOptions(false);
    }
  };

  const handleBlockUser = async (userId) => {
    const confirmed = confirm("Block this contact? You will stop seeing them in the chat list.");
    if (!confirmed) return;

    const nextIds = Array.from(new Set([...blockedIds, userId]));
    handleBlockedChange(nextIds);

    try {
      await userService.setBlock(user._id, userId);
      alert("Contact blocked.");
    } catch {
      alert("The contact was hidden locally, but the server update failed.");
    }
  };

  const handleDeleteChat = async (userId) => {
    const confirmed = confirm("Delete this chat? Existing messages will be removed.");
    if (!confirmed) return;

    try {
      await chatService.deleteChat(user._id, userId);
      setMessages([]);
      setSelectedUser(null);
      setUsers((currentUsers) =>
        currentUsers.map((candidate) =>
          candidate._id === userId
            ? {
                ...candidate,
                lastMessage: "",
                lastMessageType: "text",
                lastMediaName: null,
                lastMessageAt: null,
              }
            : candidate
        )
      );
      alert("Chat deleted.");
    } catch (error) {
      alert(error.response?.data?.msg || "Failed to delete chat.");
    }
  };

  const handleDeleteMessageForMe = async (message) => {
    if (!message?._id) return;

    try {
      await chatService.deleteMessageForMe(message._id, user._id);
      setMessages((currentMessages) =>
        currentMessages.filter((currentMessage) => String(currentMessage._id) !== String(message._id))
      );
      await refreshRecentChats();
    } catch (error) {
      alert(error.response?.data?.msg || "Failed to delete the message for you.");
    }
  };

  const handleDeleteMessageForEveryone = async (message) => {
    if (!message?._id) return;

    const confirmed = confirm("Delete this message for everyone?");
    if (!confirmed) return;

    try {
      const response = await chatService.deleteMessageForEveryone(message._id, user._id);
      const updatedMessage = response.data?.message;

      if (updatedMessage) {
        setMessages((currentMessages) =>
          currentMessages.map((currentMessage) =>
            String(currentMessage._id) === String(updatedMessage._id)
              ? { ...currentMessage, ...updatedMessage }
              : currentMessage
          )
        );
      }

      await refreshRecentChats();
    } catch (error) {
      alert(error.response?.data?.msg || "Failed to delete the message for everyone.");
    }
  };

  const handleMuteChat = (shouldMute) => {
    if (!selectedUser?._id) return;

    setMutedIds((currentMuted) =>
      shouldMute
        ? Array.from(new Set([...currentMuted, selectedUser._id]))
        : currentMuted.filter((id) => id !== selectedUser._id)
    );
  };

  const handleSearch = (term, filter) => {
    setSearchTerm(term);
    setFilterType(filter);
  };

  const ensureLocalStream = async (withVideo = false) => {
    if (localStream) return localStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });

    setLocalStream(stream);
    return stream;
  };

  const flushPendingCandidates = async (peerConnection) => {
    const pending = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];

    for (const candidate of pending) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid pending candidates.
      }
    }
  };

  const setupPeerConnection = async (targetUserId, stream) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current = peerConnection;

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    const remoteMediaStream = new MediaStream();
    setRemoteStream(remoteMediaStream);

    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteMediaStream.addTrack(track));
      setRemoteStream(remoteMediaStream);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendCallSignal({
          toUserId: targetUserId,
          fromUserId: user._id,
          data: { type: "ice-candidate", candidate: event.candidate.toJSON() },
        });
      }
    };

    return peerConnection;
  };

  const cleanupCallMedia = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    pendingCandidatesRef.current = [];
  };

  useEffect(() => {
    if (!isNativeApp()) return undefined;
    if (!readChatSettings().notifyMessages) return undefined;

    void requestNativeNotificationPermission();
    return undefined;
  }, []);

  useEffect(() => {
    const removeHandler = setNotificationTapHandler((senderId) => {
      if (!senderId) return;
      setPendingChatUserId(String(senderId));
    });

    return removeHandler;
  }, []);

  useEffect(() => {
    if (!pendingChatUserId) return;
    const match = users.find((candidate) => String(candidate._id) === String(pendingChatUserId));
    if (!match) return;

    void openChatByUserId(pendingChatUserId);
    setPendingChatUserId("");
  }, [pendingChatUserId, users]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    return setNativeBackHandler(async () => {
      if (showMenu) {
        setShowMenu(false);
        return true;
      }

      if (showChatOptions) {
        setShowChatOptions(false);
        return true;
      }

      if (showProfileModal) {
        setShowProfileModal(false);
        return true;
      }

      if (showSettings) {
        setShowSettings(false);
        return true;
      }

      if (incomingCall) {
        await handleRejectCall();
        return true;
      }

      if (selectedUserRef.current) {
        setSelectedUser(null);
        setMessages([]);
        setIsTyping(false);
        return true;
      }

      return false;
    });
  }, [incomingCall, showChatOptions, showMenu, showProfileModal, showSettings]);

  const usersById = users.reduce((accumulator, candidate) => {
    accumulator[candidate._id] = candidate;
    return accumulator;
  }, user ? { [user._id]: user } : {});

  const onlineCount = users.filter((candidate) => candidate.isOnline).length;
  const activeMuted = selectedUser ? mutedIds.includes(selectedUser._id) : false;
  const recentStatuses = statuses.filter(
    (entry) => Date.now() - new Date(entry.createdAt).getTime() < 24 * 60 * 60 * 1000
  ).length;
  const nativeApp = isNativeApp();
  const androidApp = isAndroidApp();

  return (
    <div className="app-shell native-screen safe-top-pad px-0 py-0 lg:p-6">
      <div className="mx-auto flex min-h-[var(--app-height)] max-w-[1600px] overflow-hidden lg:min-h-[calc(100vh-3rem)] lg:rounded-[36px] lg:border lg:border-white/10 lg:bg-slate-950/30 lg:shadow-[0_40px_140px_rgba(0,0,0,0.48)]">
        <aside
          className={`${selectedUser ? "hidden lg:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-white/90 text-slate-900 backdrop-blur-xl lg:w-[390px] lg:shrink-0`}
        >
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-slate-400">
                  {androidApp ? "Android base" : "Realtime hub"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">Chatify</h1>
              </div>

              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleProfileClick(user)}
                  className="rounded-[20px] border border-slate-200 p-1 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Avatar user={user} size="md" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowMenu((current) => !current)}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                >
                  <Icon name="menu" className="h-5 w-5" />
                </button>

                {showMenu ? (
                  <div className="absolute right-0 top-14 z-30 w-60 rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                    <button
                      type="button"
                      onClick={() => handleProfileClick(user)}
                      className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon name="user" className="h-4 w-4" />
                      View profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSettings(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon name="settings" className="h-4 w-4" />
                      Open settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarTab("calls");
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icon name="phone" className="h-4 w-4" />
                      Call history
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                    >
                      <Icon name="logout" className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-[30px] bg-[linear-gradient(160deg,#0f172a_0%,#14304a_55%,#17525d_100%)] p-5 text-white">
              <div className="flex items-center gap-3">
                <Avatar user={user} size="lg" />
                <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{user?.name}</p>
                <p className="mt-1 truncate text-xs uppercase tracking-[0.24em] text-slate-300">
                  {user?.email || user?.phoneNumber || "Email not set"}
                </p>
                <p className="mt-1 truncate text-sm text-slate-200">
                  {user?.statusMessage || "Write a short intro from your profile."}
                </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-white/10 bg-white/7 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Online</p>
                  <p className="mt-2 text-2xl font-semibold">{onlineCount}</p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/7 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Statuses</p>
                  <p className="mt-2 text-2xl font-semibold">{recentStatuses}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 hidden rounded-full bg-slate-100 p-1 lg:block">
              <div className="grid grid-cols-3 gap-1 text-sm font-semibold text-slate-500">
                {["chats", "calls", "status"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSidebarTab(tab)}
                    className={`rounded-full px-3 py-2 transition ${
                      sidebarTab === tab ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {androidApp ? (
              <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-sky-950">
                <p className="font-semibold">Android mode is active.</p>
                <p className="mt-1 leading-6 text-sky-900/80">
                  Back button closes open layers first, camera shortcuts are enabled, and message notifications can show outside the app.
                </p>
              </div>
            ) : null}
          </div>

          {sidebarTab === "chats" ? (
            <SearchAndFilter
              users={filteredUsers}
              selectedUser={selectedUser}
              onSelectUser={handleSelectUser}
              onSearch={handleSearch}
            />
          ) : null}

          {sidebarTab === "calls" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 soft-scrollbar lg:pb-4">
              <CallHistoryList calls={callHistory} usersById={usersById} />
            </div>
          ) : null}

          {sidebarTab === "status" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="px-4 pt-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Post a fresh status</p>
                      <p className="mt-1 text-sm text-slate-500">Share a quick note or an image update.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      {statusText.length}
                    </span>
                  </div>

                  <textarea
                    value={statusText}
                    onChange={(event) => setStatusText(event.target.value)}
                    placeholder="What is happening right now?"
                    rows={3}
                    className="mt-4 w-full resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-slate-900 focus:bg-white"
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                        <Icon name="image" className="h-4 w-4" />
                        Gallery
                        <input type="file" accept="image/*" className="hidden" onChange={handleStatusImage} />
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                        <Icon name="camera" className="h-4 w-4" />
                        Camera
                        <input
                          type="file"
                          accept="image/*"
                          capture={androidApp ? "environment" : undefined}
                          className="hidden"
                          onChange={handleStatusImage}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePostStatus("text", null, statusText)}
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Post status
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-4 soft-scrollbar lg:pb-4">
                <StatusList statuses={statuses} usersById={usersById} currentUserId={user._id} />
              </div>
            </div>
          ) : null}

          {!selectedUser ? (
            <div className="mobile-bottom-dock safe-bottom-pad safe-x-pad fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white to-white/80 py-3 lg:hidden">
              <div className="mx-auto grid max-w-xl grid-cols-4 gap-2 rounded-[26px] border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                {[
                  { key: "chats", label: "Chats", icon: "chat" },
                  { key: "calls", label: "Calls", icon: "phone" },
                  { key: "status", label: "Status", icon: "status" },
                  { key: "settings", label: "Settings", icon: "settings" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.key === "settings") {
                        setShowSettings(true);
                        return;
                      }
                      setSidebarTab(item.key);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-3 text-[11px] font-semibold transition ${
                      (item.key === sidebarTab && item.key !== "settings")
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className={`${selectedUser ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>
          {selectedUser ? (
            <>
              <div className="glass-card border-b border-white/10 px-4 py-4 lg:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="rounded-full border border-white/10 p-2 text-white transition hover:bg-white/6 lg:hidden"
                    >
                      <Icon name="back" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProfileClick(selectedUser)}
                      className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-white/6 px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <Avatar user={selectedUser} size="md" />
                      <div>
                        <p className="text-base font-semibold text-white">{selectedUser.name}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {selectedUser.isOnline ? "Active now" : formatLastSeen(selectedUser.lastSeen)}
                        </p>
                        {selectedUser.phoneNumber || selectedUser.email ? (
                          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                            {selectedUser.email || selectedUser.phoneNumber}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeMuted ? (
                      <span className="hidden rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-950 sm:inline-flex">
                        Muted
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleStartCall}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/12"
                    >
                      <Icon name="phone" className="h-4 w-4" />
                      Call
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChatOptions((current) => !current)}
                      className="rounded-full border border-white/10 p-2 text-white transition hover:bg-white/10"
                    >
                      <Icon name="menu" className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.26em] text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">1:1 thread</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">Live sync enabled</span>
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
                    Joined {formatLongDateTime(selectedUser.createdAt)}
                  </span>
                </div>
              </div>

              {showChatOptions ? (
                <div className="px-4 pt-4 lg:px-8">
                  <ChatOptions
                    selectedUser={selectedUser}
                    onBlockUser={handleBlockUser}
                    onDeleteChat={handleDeleteChat}
                    onMuteChat={handleMuteChat}
                    isMuted={activeMuted}
                  />
                </div>
              ) : null}

              <ChatWindow
                messages={messages}
                currentUserId={user._id}
                loading={loading}
                selectedUser={selectedUser}
                isTyping={isTyping}
                onDeleteForMe={handleDeleteMessageForMe}
                onDeleteForEveryone={handleDeleteMessageForEveryone}
              />

              <div className={`glass-card keyboard-aware-bottom border-t border-white/10 px-4 py-4 lg:px-8 ${nativeApp ? "safe-bottom-pad" : ""}`}>
                <div className="rounded-[30px] border border-white/10 bg-white/6 p-3 backdrop-blur-xl">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                      <Icon name="camera" className="h-4 w-4" />
                      Camera
                      <input
                        type="file"
                        accept="image/*"
                        capture={androidApp ? "environment" : undefined}
                        className="hidden"
                        onChange={(event) => handleSendMedia(event, "image")}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                      <Icon name="image" className="h-4 w-4" />
                      Gallery
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => handleSendMedia(event, "image")} />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                      <Icon name="audio" className="h-4 w-4" />
                      Voice
                      <input
                        type="file"
                        accept="audio/*"
                        capture={androidApp ? "user" : undefined}
                        className="hidden"
                        onChange={(event) => handleSendMedia(event, "audio")}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                      <Icon name="file" className="h-4 w-4" />
                      File
                      <input type="file" className="hidden" onChange={(event) => handleSendMedia(event, "file")} />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={handleMessageChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && isEnterToSendEnabled()) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 rounded-[22px] border border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                      placeholder="Type a message and send it when ready."
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={uploading}
                      className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon name="send" className="h-4 w-4" />
                      {uploading ? "Uploading..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-2xl rounded-[36px] border border-white/10 bg-white/6 p-8 text-white backdrop-blur-xl lg:p-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-sky-100">
                  <Icon name="chat" className="h-4 w-4" />
                  Select a conversation
                </div>
                <h2 className="mt-6 text-4xl font-semibold leading-tight">
                  Your chat workspace is ready whenever you are.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  Pick someone from the sidebar to open a live thread, continue a call, or check the latest status updates.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">People online</p>
                    <p className="mt-3 text-3xl font-semibold">{onlineCount}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Recent statuses</p>
                    <p className="mt-3 text-3xl font-semibold">{recentStatuses}</p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Blocked</p>
                    <p className="mt-3 text-3xl font-semibold">{blockedIds.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {incomingCall ? (
        <div className="fixed inset-x-4 bottom-4 z-50 flex justify-end lg:inset-auto lg:bottom-8 lg:right-8">
          <div className="w-full max-w-sm rounded-[30px] border border-white/10 bg-slate-950/90 p-5 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <Avatar user={usersById[incomingCall.callerId] || { name: "Unknown" }} size="lg" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Incoming call</p>
                <p className="mt-2 text-lg font-semibold">
                  {usersById[incomingCall.callerId]?.name || "Unknown caller"}
                </p>
                <p className="mt-1 text-sm text-slate-300">Voice call waiting for your response.</p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleAcceptCall}
                className="inline-flex flex-1 items-center justify-center rounded-[18px] bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={handleRejectCall}
                className="inline-flex flex-1 items-center justify-center rounded-[18px] bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ongoingCall ? (
        <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center lg:inset-x-0 lg:bottom-8">
          <div className="flex w-full max-w-2xl flex-col gap-4 rounded-[30px] border border-white/10 bg-slate-950/90 p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid grid-cols-2 gap-2">
                <video ref={localVideoRef} autoPlay muted playsInline className="h-20 w-28 rounded-[18px] bg-black object-cover" />
                <video ref={remoteVideoRef} autoPlay playsInline className="h-20 w-28 rounded-[18px] bg-black object-cover" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-300">
                  {ongoingCall.ring ? "Calling" : "Call live"}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {usersById[ongoingCall.receiverId]?.name ||
                    usersById[ongoingCall.callerId]?.name ||
                    "Voice call"}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {ongoingCall.ring ? "Waiting for the other person to pick up." : formatDuration(callElapsed)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEndCall}
              className="inline-flex items-center justify-center rounded-[18px] bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              End call
            </button>
          </div>
        </div>
      ) : null}

      {showProfileModal ? (
        <ProfileModal user={profileUser} onClose={() => setShowProfileModal(false)} onUpdate={handleProfileUpdate} />
      ) : null}

      {showSettings ? (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenProfile={() => handleProfileClick(user)}
          blockedIds={blockedIds}
          onBlockedChange={handleBlockedChange}
        />
      ) : null}
    </div>
  );
}
