"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { getWsUrl } from "@/lib/api";
import type { QuestionResponse, WSEvent, WSPlayer } from "@/lib/types";

interface WebSocketContextType {
  players: WSPlayer[];
  userId: number | null;
  isConnected: boolean;
  lastMessage: WSEvent | null;
  gameState: {
    phase: string;
    question: QuestionResponse | null;
    questionIndex: number;
    countdown: number;
    timeRemaining: number;
    correctAnswer: number[] | null;
  };
  error: string;
  sendEvent: (event: any) => void;
  disconnect: () => void;
  ws: WebSocket | null;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ roomCode: string; children: React.ReactNode }> = ({
  roomCode,
  children,
}) => {
  const [players, setPlayers] = useState<WSPlayer[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSEvent | null>(null);
  const [error, setError] = useState("");
  
  // Persistent game state across page navigation
  const [gameState, setGameState] = useState<{
    phase: string;
    question: QuestionResponse | null;
    questionIndex: number;
    countdown: number;
    timeRemaining: number;
    correctAnswer: number[] | null;
  }>({
    phase: "waiting",
    question: null,
    questionIndex: 0,
    countdown: 3,
    timeRemaining: 20,
    correctAnswer: null,
  });

  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!roomCode) return;
    
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
    }

    try {
      const guestToken = typeof window !== "undefined" ? sessionStorage.getItem("guest_token") : null;
      const guestRoomCode = typeof window !== "undefined" ? sessionStorage.getItem("guest_room_code") : null;
      
      // Use guest token if it matches the current room code
      const effectiveToken = (guestRoomCode === roomCode) ? guestToken : undefined;
      
      const wsUrl = getWsUrl(roomCode, effectiveToken || undefined);
      console.log("🔌 [Shared WS] Connecting to:", roomCode, effectiveToken ? "(as guest)" : "(as user)");
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("✅ [Shared WS] Connected to room:", roomCode);
        setIsConnected(true);
        setError("");
        wsRef.current = socket;
      };

      socket.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          setLastMessage(data);

          if (data.event === "connection_ready" && data.user_id !== undefined) {
            setUserId(Number(data.user_id));
          }

          // Update internal state based on event type
          if (data.participants) {
            setPlayers(data.participants);
          }

          if (data.event === "game_starting") {
            setGameState(prev => ({ ...prev, phase: "countdown", countdown: data.countdown || 3 }));
          } else if (data.event === "game_started") {
            setGameState(prev => ({ ...prev, phase: "waiting" }));
          } else if (data.event === "question_start" || data.event === "question") {
            setGameState(prev => ({ 
                ...prev, 
                phase: "question", 
                question: data.question || null,
                questionIndex: data.question_index !== undefined ? data.question_index : prev.questionIndex,
                timeRemaining: data.question?.time_limit || 20,
                correctAnswer: null
            }));
          } else if (data.event === "question_timer") {
            setGameState(prev => ({ ...prev, timeRemaining: data.time_remaining ?? prev.timeRemaining }));
          } else if (data.event === "question_time_up" || data.event === "result") {
            setGameState(prev => ({ 
                ...prev, 
                phase: "answer_reveal",
                correctAnswer: data.correct_answer || prev.correctAnswer
            }));
          } else if (data.event === "game_finished" || data.event === "game_end") {
            setGameState(prev => ({ ...prev, phase: "final" }));
          } else if (data.event === "state_recovered" && data.state) {
              const state = data.state;
              setGameState({
                  phase: "question",
                  question: state.question || null,
                  questionIndex: state.question_index ?? 0,
                  countdown: 3,
                timeRemaining: state.time_remaining ?? state.duration ?? state.question?.time_limit ?? 20,
                  correctAnswer: null
              });
          }
        } catch (err) {
          console.error("❌ [Shared WS] Failed to parse message", err);
        }
      };

      socket.onerror = (event) => {
        console.error("❌ [Shared WS] Error:", event);
        setError("Failed to connect to game room.");
        setIsConnected(false);
      };

      socket.onclose = (event) => {
        console.log("🔌 [Shared WS] Closed:", event.code, event.reason);
        setIsConnected(false);
        // Only clear ref if it's actually THIS socket closing
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
      };

      wsRef.current = socket;
    } catch (err) {
      console.error("❌ [Shared WS] Connection error:", err);
      setError("Failed to connect to game room.");
      setIsConnected(false);
    }
  }, [roomCode]);

  useEffect(() => {
    connect();
    // No cleanup that closes the socket here, we manage it in connect() 
    // and rely on onclose to clear the ref. 
    // This prevents StrictMode from killing the connection immediately.
  }, [connect]);

  const sendEvent = useCallback((event: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    } else {
      console.error("❌ [Shared WS] Cannot send, socket not open");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        players,
        userId,
        isConnected,
        lastMessage,
        gameState,
        error,
        sendEvent,
        disconnect,
        ws: wsRef.current,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return context;
};
