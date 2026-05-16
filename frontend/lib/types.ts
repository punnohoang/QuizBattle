// TypeScript type definitions for QuizBattle

export interface User {
  id: number;
  email: string;
  username: string;
  role?: "user" | "guest";
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
  is_public?: boolean;
}

export interface QuizResponse {
  id: number;
  user_id: number;
  owner_username?: string;
  title: string;
  description: string | null;
  category: string;
  question_count: number;
  is_deleted: boolean;
  is_public: boolean;
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

export interface RoomAccessResponse {
  room_id: number;
  room_code: string;
  status: string;
  is_host: boolean;
}

// ─── History types ───────────────────────────────
export interface HistoryOption {
  id: number;
  content: string;
}

export interface PlayedQuestionHistory {
  question_id: number;
  question_order_index: number;
  question_content: string;
  question_type: string;
  selected_option_ids: number[];
  selected_options: HistoryOption[];
  correct_option_ids: number[];
  correct_options: HistoryOption[];
  is_correct: boolean;
  score_earned: number;
  response_time_ms: number;
  response_time_seconds: number;
}

export interface PlayedSessionSummary {
  session_id: number;
  room_code: string;
  quiz_id: number;
  quiz_title: string;
  host_username: string;
  started_at: string | null;
  ended_at: string | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy_percentage: number;
  average_response_time_ms: number;
  average_response_time_seconds: number;
  top_players: LeaderboardEntry[];
}

export interface PlayedSessionDetail extends PlayedSessionSummary {
  questions: PlayedQuestionHistory[];
}

export interface HostedPlayerHistory {
  user_id: number;
  username: string;
  total_score: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy_percentage: number;
}

export interface HostedSessionHistory {
  session_id: number;
  room_code: string;
  quiz_id: number;
  quiz_title: string;
  started_at: string | null;
  ended_at: string | null;
  participant_count: number;
  total_answers: number;
  correct_answers: number;
  wrong_answers: number;
  correct_rate: number;
  wrong_rate: number;
  average_response_time_ms: number;
  average_response_time_seconds: number;
  top_players: HostedPlayerHistory[];
}

export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface UserHistoryResponse {
  played_sessions: PlayedSessionSummary[];
  hosted_sessions: HostedSessionHistory[];
  played_pagination: PaginationMetadata;
  hosted_pagination: PaginationMetadata;
}

// ─── WebSocket event types ────────────────────────
export interface WSPlayer {
  user_id: number;
  username: string;
}

export interface LeaderboardEntry {
  user_id: number;
  score: number;
  username?: string;
}

export interface WSEvent {
  event:
    | "player_joined"
    | "player_left"
    | "player_answered"
    | "connection_ready"
    | "game_start"
    | "question"
    | "result"
    | "game_end"
    | "game_finished"
    | "game_error"
    | "game_starting"
    | "game_started"
    | "question_start"
    | "question_timer"
    | "question_time_up"
    | "state_recovered"
    | "answer_result";
  player?: WSPlayer;
  participants?: WSPlayer[];
  user_id?: number;
  username?: string;
  // game events
  question?: QuestionResponse;
  scores?: Record<number, number>;
  leaderboard?: LeaderboardEntry[];
  // new timer events
  countdown?: number;
  time_remaining?: number;
  correct_answer?: number[];
  question_index?: number;
  success?: boolean;
  result?: any;
  message?: string;
  state?: any;
}
