import axios from "axios";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send HttpOnly cookies (refresh_token)
});

// ─── Request interceptor: attach access token ─────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject })
        ).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refresh_token = localStorage.getItem("refresh_token");
        if (!refresh_token) throw new Error("No refresh token");

        const { data } = await api.post("/auth/refresh", {
          refresh_token,
        });
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        processQueue(null, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (e) {
        processQueue(e);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
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
  me: () => api.get("/auth/me"),
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

export const getWsUrl = (roomCode: string) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
  const wsBase = BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/ws/room/${roomCode}?token=${token}`;
};
