"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import AuthGuard from "../../../components/AuthGuard";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useWebSocket } from "@/lib/websocket";
import { useAuthStore } from "@/lib/store";
import { roomApi } from "@/lib/api";
import type { RoomAccessResponse } from "@/lib/types";

export default function WaitRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { code } = use(params);
  const { players, isConnected, sendEvent, disconnect, error: wsError, ws } = useWebSocket(code);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [error, setError] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (wsError) setError(wsError);
  }, [wsError]);

  // Listen for game_started event to redirect players to play page
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: Event) => {
      try {
        const messageEvent = event as MessageEvent;
        const data = JSON.parse(messageEvent.data);

        if (data.event === "game_started" && !isHost) {
          console.log("🎮 Game started! Redirecting to play page...");
          router.push(`/room/${code}/play`);
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, isHost, code, router]);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        setCheckingAccess(true);
        const { data } = await roomApi.access(code) as { data: RoomAccessResponse };
        if (!cancelled) {
          setIsHost(data.is_host);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Unable to verify room access.");
        }
      } finally {
        if (!cancelled) setCheckingAccess(false);
      }
    };

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleStartGame = () => {
    startGame();
  };

  const startGame = async () => {
    try {
      setError("");
      const response = await roomApi.start(code);

      if (response.status === 200) {
        await roomApi.startQuestions(code);
        // Game started successfully, wait for countdown and then redirect to play
        setTimeout(() => {
          router.push(`/room/${code}/play`);
        }, 3500); // Wait for 3s countdown + 0.5s buffer
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Failed to start game";
      setError(errorMsg);
      console.error(err);
    }
  };

  const handleDisconnect = () => {
    setDisconnecting(true);
    disconnect();
    router.push("/join");
  };

  return (
    <AuthGuard>
      <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column" }}>
        <Navbar />

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 600 }} className="animate-fadeIn">

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              {/* Connection status dot */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: isConnected ? "var(--success-light)" : "var(--warning-light)",
                  border: `1px solid ${isConnected ? "#6ee7b7" : "#fcd34d"}`,
                  color: isConnected ? "var(--success)" : "var(--warning)",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: isConnected ? "var(--success)" : "var(--warning)",
                    animation: isConnected ? "none" : "pulse 1.5s infinite",
                  }}
                />
                {isConnected ? "Connected" : "Connecting..."}
              </div>

              <h1 style={{ fontSize: "2.25rem", fontWeight: 900, color: "var(--primary)", marginBottom: 6 }}>
                Room{" "}
                <span
                  style={{
                    fontFamily: "monospace",
                    background: "var(--primary-muted)",
                    padding: "2px 12px",
                    borderRadius: 8,
                    fontSize: "2rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  {code}
                </span>
              </h1>
              <p style={{ color: "var(--text-secondary)" }}>
                Share this code with friends to let them join
              </p>
            </div>

            {error && (
              <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Players Card */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                  paddingBottom: 14,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 0, color: "var(--text-primary)" }}>
                  Players Joined
                </h2>
                <span
                  style={{
                    background: "var(--primary)",
                    color: "white",
                    borderRadius: 999,
                    padding: "2px 12px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                  }}
                >
                  {players.length}
                </span>
              </div>

              {players.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: 12,
                  }}
                >
                  {players.map((player) => (
                    <div
                      key={player.user_id}
                      style={{
                        padding: "14px 12px",
                        borderRadius: 12,
                        background: player.user_id === user?.id
                          ? "var(--primary-muted)"
                          : "var(--surface-alt)",
                        border: `1.5px solid ${player.user_id === user?.id ? "var(--accent-light)" : "var(--border)"}`,
                        textAlign: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      <div
                        className="avatar"
                        style={{ margin: "0 auto 8px", width: 44, height: 44, fontSize: "1rem" }}
                      >
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                        {player.username}
                      </div>
                      {player.user_id === user?.id && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--accent)",
                            fontWeight: 700,
                            marginTop: 2,
                            letterSpacing: "0.04em",
                          }}
                        >
                          YOU
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)" }}>
                  <LoadingSpinner />
                  <p style={{ marginTop: 16, fontSize: "0.9rem" }}>Waiting for players to join...</p>
                </div>
              )}
            </div>

            {/* Info card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderRadius: 12,
                background: "var(--primary-muted)",
                border: "1px solid var(--accent-light)",
                marginBottom: 28,
                fontSize: "0.875rem",
                color: "var(--primary)",
                fontWeight: 500,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>💡</span>
              <span>
                Players can join at{" "}
                <strong style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>{code}</strong>
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              {!isHost ? (
                <button
                  onClick={handleDisconnect}
                  className="btn btn-secondary btn-lg"
                  disabled={disconnecting || checkingAccess}
                  style={{ flex: 1 }}
                >
                  {checkingAccess ? (
                    <><div className="spinner spinner-sm" /> Checking...</>
                  ) : disconnecting ? (
                    <><div className="spinner spinner-sm" /> Disconnecting...</>
                  ) : (
                    "Disconnect"
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleStartGame}
                    className="btn btn-primary btn-lg"
                    disabled={checkingAccess}
                    style={{ flex: 1 }}
                  >
                    {checkingAccess ? (
                      <><div className="spinner spinner-sm" /> Checking...</>
                    ) : !isConnected ? (
                      <><div className="spinner spinner-sm" /> Connecting...</>
                    ) : (
                      "▶ Start Game"
                    )}
                  </button>
                  <Link href="/dashboard" className="btn btn-secondary btn-lg">
                    Cancel
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
