// TypeScript type definitions for QuizBattle

export interface User {
  id: number;
  email: string;
  username: string;
  avatar_url?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── Quiz types ───────────────────────────────────
export interface OptionCreate {
  content: string;
  is_correct: boolean;
  order_index: number;
}

export interface OptionResponse {
  id: number;
  content: string;
  is_correct: boolean;
  order_index: number;
}

export interface QuestionCreate {
  content: string;
  type: "multiple_choice" | "true_false";
  score_type: "normal" | "double";
  time_limit: number | null;
  order_index: number;
  options: OptionCreate[];
}

export interface QuestionResponse {
  id: number;
  quiz_id: number;
  content: string;
  type: string;
  score_type: string;
  time_limit: number | null;
  order_index: number;
  options: OptionResponse[];
  created_at: string;
  updated_at: string;
}

export interface QuizCreate {
  title: string;
  description?: string;
  category: string;
}

export interface QuizResponse {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  category: string;
  question_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizDetailResponse extends QuizResponse {
  questions: QuestionResponse[];
}

// ─── Room types ───────────────────────────────────
export interface RoomResponse {
  id: number;
  room_code: string;
  status: string;
}

// ─── WebSocket event types ────────────────────────
export interface WSPlayer {
  user_id: number;
  username: string;
}

export interface WSEvent {
  event: "player_joined" | "player_left" | "game_start" | "question" | "result" | "game_end";
  player?: WSPlayer;
  participants?: WSPlayer[];
  // game events (future)
  question?: QuestionResponse;
  scores?: Record<number, number>;
}
