import axios from "axios";
import { getApiBaseUrlCandidates, rememberResolvedApiBaseUrl } from "../utils/platform";

const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS_CODES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

function readAuthToken() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("token") || "";
}

function buildHeaders({ authenticated = false, headers = {} } = {}) {
  const nextHeaders = { ...headers };

  if (!authenticated) {
    return nextHeaders;
  }

  const token = readAuthToken();
  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  return nextHeaders;
}

function shouldRetryWithNextBaseUrl(error) {
  if (!error?.response) return true;
  return RETRYABLE_STATUS_CODES.has(Number(error.response.status));
}

function buildConnectionError(error) {
  error.userMessage =
    "Server se connection nahi ho paaya. Internet ya backend URL check karke dobara try karo.";
  return error;
}

async function sendApiRequest({ method, path, data, params, authenticated = false, headers }) {
  const baseUrls = getApiBaseUrlCandidates();
  let lastError = null;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];

    try {
      const response = await axios({
        method,
        url: `${baseUrl}${path}`,
        data,
        params,
        timeout: REQUEST_TIMEOUT_MS,
        headers: buildHeaders({ authenticated, headers }),
      });

      rememberResolvedApiBaseUrl(baseUrl);
      return response;
    } catch (error) {
      lastError = error;

      if (!shouldRetryWithNextBaseUrl(error) || index === baseUrls.length - 1) {
        if (!error?.response) {
          throw buildConnectionError(error);
        }
        throw error;
      }
    }
  }

  throw lastError;
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  requestOtp: ({ email, mode, name }) => {
    return sendApiRequest({
      method: "post",
      path: "/auth/request-otp",
      data: { email, mode, name },
    });
  },
  verifyOtp: ({ email, otp, mode, name }) => {
    return sendApiRequest({
      method: "post",
      path: "/auth/verify-otp",
      data: { email, otp, mode, name },
    });
  },
  signup: ({ name, email, password }) => {
    return sendApiRequest({
      method: "post",
      path: "/auth/signup",
      data: { name, email, password },
    });
  },
  login: (email, password) => {
    return sendApiRequest({
      method: "post",
      path: "/auth/login",
      data: { email, password },
    });
  },
};

export const userService = {
  getAllUsers: (viewerId) => {
    return sendApiRequest({
      method: "get",
      path: "/users",
      params: { viewerId },
      authenticated: true,
    });
  },
  getUserProfile: (userId) => {
    return sendApiRequest({
      method: "get",
      path: `/users/${userId}`,
      authenticated: true,
    });
  },
  updateProfile: (userId, data) => {
    return sendApiRequest({
      method: "put",
      path: `/users/${userId}`,
      data,
      authenticated: true,
    });
  },
  changePassword: (userId, newPassword) => {
    return sendApiRequest({
      method: "put",
      path: `/users/${userId}/password`,
      data: { newPassword },
      authenticated: true,
    });
  },
  deleteAccount: (userId) => {
    return sendApiRequest({
      method: "delete",
      path: `/users/${userId}`,
      authenticated: true,
    });
  },
  setBlock: (userId, contactId) => {
    return sendApiRequest({
      method: "put",
      path: `/users/${userId}/block/${contactId}`,
      authenticated: true,
    });
  },
  setUnblock: (userId, contactId) => {
    return sendApiRequest({
      method: "put",
      path: `/users/${userId}/unblock/${contactId}`,
      authenticated: true,
    });
  },
};

export const chatService = {
  getMessages: (user1, user2) => {
    return sendApiRequest({
      method: "get",
      path: `/chat/${user1}/${user2}`,
      authenticated: true,
    });
  },
  getRecentChats: (userId) => {
    return sendApiRequest({
      method: "get",
      path: `/chat/recent/${userId}`,
      authenticated: true,
    });
  },
  deleteChat: (user1, user2) => {
    return sendApiRequest({
      method: "delete",
      path: `/chat/${user1}/${user2}`,
      authenticated: true,
    });
  },
  deleteMessageForMe: (messageId, userId) => {
    return sendApiRequest({
      method: "put",
      path: `/chat/message/${messageId}/delete-for-me`,
      data: { userId },
      authenticated: true,
    });
  },
  deleteMessageForEveryone: (messageId, userId) => {
    return sendApiRequest({
      method: "put",
      path: `/chat/message/${messageId}/delete-for-everyone`,
      data: { userId },
      authenticated: true,
    });
  },
};

export const callService = {
  getCallHistory: (userId) =>
    sendApiRequest({
      method: "get",
      path: `/calls/${userId}`,
      authenticated: true,
    }),
  createCallLog: (payload) =>
    sendApiRequest({
      method: "post",
      path: "/calls",
      data: payload,
      authenticated: true,
    }),
};

export const statusService = {
  getStatuses: () =>
    sendApiRequest({
      method: "get",
      path: "/status",
      authenticated: true,
    }),
  createStatus: (payload) =>
    sendApiRequest({
      method: "post",
      path: "/status",
      data: payload,
      authenticated: true,
    }),
};
