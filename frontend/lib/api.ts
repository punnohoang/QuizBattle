import axios, { AxiosHeaders } from "axios";
import { cleanupLegacyAuthStorage, isGuestSession, useAuthStore } from "./store";

const envBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const BASE_URL = (() => {
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
})();

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send HttpOnly cookies automatically
});

// ─── Request interceptor: attach guest bearer token ───
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const guestToken = sessionStorage.getItem("guest_token");
    const hasRealUser = !!useAuthStore.getState().user;

    if (guestToken && !hasRealUser) {
      const headers = AxiosHeaders.from(config.headers ?? {});
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${guestToken}`);
        config.headers = headers;
      }
    }
  }

  return config;
});

// ─── Response interceptor: auto refresh on 401 ───
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    const isGuest =
      typeof window !== "undefined" &&
      isGuestSession() &&
      !useAuthStore.getState().user;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh") &&
      !original.url?.includes("/users/me")
    ) {
      if (isGuest) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject })
        ).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // No body needed — refresh_token is in the HttpOnly cookie
        await api.post("/auth/refresh");
        processQueue(null);
        return api(original);
      } catch (e) {
        processQueue(e);
        useAuthStore.getState().logout();
        cleanupLegacyAuthStorage();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Typed API helpers ────────────────────────────
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  guestJoin: (data: { nickname: string; room_code: string }) =>
    api.post("/auth/guest-join", data),
};

export const userApi = {
  me: () => api.get("/users/me"),
  updateMe: (data: { username?: string; current_password?: string; new_password?: string; avatar_url?: string }) =>
    api.patch("/users/me", data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/users/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const quizApi = {
  list: (params?: { skip?: number; limit?: number; category?: string }) =>
    api.get("/quizzes", { params }),
  listPublic: (params?: { skip?: number; limit?: number; category?: string }) =>
    api.get("/quizzes/public", { params }),
  get: (id: number) => api.get(`/quizzes/${id}`),
  create: (data: { title: string; description?: string; category: string; is_public?: boolean }) =>
    api.post("/quizzes", data),
  update: (
    id: number,
    data: { title?: string; description?: string; category?: string; is_public?: boolean }
  ) => api.put(`/quizzes/${id}`, data),
  clone: (id: number) => api.post(`/quizzes/${id}/clone`),
  delete: (id: number) => api.delete(`/quizzes/${id}`),

  getQuestions: (quizId: number) => api.get(`/quizzes/${quizId}/questions`),
  createQuestion: (quizId: number, data: object) => {
    const payload = mapQuestionPayload(data);
    return api.post(`/quizzes/${quizId}/questions`, payload);
  },
  updateQuestion: (quizId: number, questionId: number, data: object) => {
    const payload = mapQuestionPayload(data);
    return api.put(`/quizzes/${quizId}/questions/${questionId}`, payload);
  },
  deleteQuestion: (quizId: number, questionId: number) =>
    api.delete(`/quizzes/${quizId}/questions/${questionId}`),
};

// Helper: map frontend-friendly question type strings to backend enums
function mapQuestionPayload(data: any) {
  if (!data || typeof data !== "object") return data;
  const mapped = { ...data };
  if (mapped.type === "multiple_choice") mapped.type = "MTC";
  else if (mapped.type === "true_false") mapped.type = "TF";
  return mapped;
}

export const roomApi = {
  create: (quiz_id: number) => api.post("/rooms", { quiz_id }),
  access: (room_code: string) => api.get(`/rooms/${room_code}/access`),
  start: (room_code: string) => api.post(`/rooms/${room_code}/start`),
  startQuestions: (room_code: string) => api.post(`/rooms/${room_code}/start-questions`),
};

export const historyApi = {
  me: (limit = 5, playedPage = 1, hostedPage = 1) =>
    api.get("/history/me", { params: { limit, played_page: playedPage, hosted_page: hostedPage } }),
  playedDetail: (sessionId: number) => api.get(`/history/played/${sessionId}`),
};

/**
 * Build a WebSocket URL for a room.
 *
 * - Real users: no token in URL — the browser sends the access_token HttpOnly
 *   cookie automatically during the WebSocket HTTP upgrade handshake.
 * - Guests: must pass ?token=<guest_token> because sessionStorage values are
 *   not automatically sent and HttpOnly cookies are not available to guests.
 */
export const getWsUrl = (roomCode: string, guestToken?: string) => {
  const wsBase = BASE_URL.replace(/^http/, "ws");

  if (guestToken) {
    const url = `${wsBase}/ws/room/${roomCode}?token=${encodeURIComponent(guestToken)}`;
    console.log("🔗 [API] WS URL (guest):", url.split("?")[0] + "?token=***");
    return url;
  }

  const url = `${wsBase}/ws/room/${roomCode}`;
  console.log("🔗 [API] WS URL (auth cookie):", url);
  return url;
};
