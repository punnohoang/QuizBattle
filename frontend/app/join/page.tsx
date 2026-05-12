"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import AuthGuard from "../components/AuthGuard";

const ROOM_CODE_LENGTH = 6;

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = roomCode.trim().toUpperCase();

    if (!normalized) {
      setError("Please enter a room code.");
      return;
    }

    if (normalized.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters.`);
      return;
    }

    setError("");
    router.push(`/room/${normalized}/wait`);
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)" }}>
        <Navbar />

        <div
          style={{
            minHeight: "calc(100vh - 64px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <form onSubmit={handleJoin} style={{ width: "100%", maxWidth: 420 }}>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
                setRoomCode(next);
                if (error) setError("");
              }}
              placeholder="Enter room code"
              autoFocus
              maxLength={ROOM_CODE_LENGTH}
              style={{
                textAlign: "center",
                letterSpacing: "0.12em",
                fontFamily: "monospace",
                fontSize: "1.15rem",
                padding: "14px 16px",
              }}
            />
            {error && (
              <p style={{ marginTop: 10, color: "var(--danger)", fontSize: "0.88rem" }}>{error}</p>
            )}
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }}>
              Join
            </button>
          </form>
        </div>
      </div>
    </AuthGuard>
  );
}
