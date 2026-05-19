"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { authApi, roomApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const ROOM_CODE_LENGTH = 6;

export default function JoinRoomPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill nickname if user is authenticated
  useEffect(() => {
    if (isAuthenticated() && user) {
      setNickname(user.username);
    }
  }, [user, isAuthenticated]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = roomCode.trim().toUpperCase();
    const normalizedNickname = nickname.trim();
    const hasRealAuth = isAuthenticated() && user;

    if (!normalizedNickname) {
      setError("Please enter a nickname.");
      return;
    }

    if (!normalizedCode) {
      setError("Please enter a room code.");
      return;
    }

    if (normalizedCode.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters.`);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      if (hasRealAuth) {
        await roomApi.access(normalizedCode);

        if (typeof window !== "undefined") {
          sessionStorage.removeItem("guest_token");
          sessionStorage.removeItem("guest_user");
          sessionStorage.removeItem("guest_room_code");
        }
      } else {
        const { data } = await authApi.guestJoin({
          nickname: normalizedNickname,
          room_code: normalizedCode,
        });

        if (typeof window !== "undefined") {
          sessionStorage.setItem("guest_token", data.access_token);
          sessionStorage.setItem("guest_user", JSON.stringify(data.user));
          sessionStorage.setItem("guest_room_code", normalizedCode);
        }
      }

      router.push(`/room/${normalizedCode}/wait`);
    } catch (err: any) {
      setIsLoading(false);
      const status = err.response?.status;
      if (status === 404) {
        setError("❌ Room not found. Please check the code and try again.");
      } else {
        setError(err.response?.data?.detail || "Failed to join room. Please try again.");
      }
    }
  };

  return (
    <div 
      style={{ 
        minHeight: "100vh", 
        background: "var(--background)",
        backgroundImage: "radial-gradient(circle at 10% 20%, rgba(30, 58, 138, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 40%)",
        display: "flex",
        flexDirection: "column"
      }}
    >
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
        <div style={{ width: "100%", maxWidth: 480 }} className="animate-fadeIn">
          {/* Main Card */}
          <div 
            className="glass" 
            style={{ 
              padding: "48px 40px",
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.4)",
              borderRadius: "32px",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {/* Decorative background element */}
            <div style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "150px",
              height: "150px",
              background: "var(--primary-light)",
              borderRadius: "50%",
              filter: "blur(60px)",
              opacity: 0.5,
              zIndex: 0
            }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: "40px" }}>
                <h1 style={{ 
                  fontSize: "2.5rem", 
                  fontWeight: 900, 
                  letterSpacing: "-0.02em",
                  marginBottom: "8px",
                  background: "var(--gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent"
                }}>
                  Join the Battle
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem" }}>
                  Enter your details to start playing!
                </p>
              </div>
              
              <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                    What should we call you?
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "1.2rem", opacity: 0.6 }}>👤</span>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Your nickname"
                      style={{ 
                        paddingLeft: "44px",
                        height: "56px",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "16px",
                        border: "2px solid var(--border)",
                        background: "rgba(255, 255, 255, 0.7)"
                      }}
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "10px", color: "var(--text-primary)" }}>
                    Room Code
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "1.2rem", opacity: 0.6 }}>🔑</span>
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => {
                        const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
                        setRoomCode(next);
                        if (error) setError("");
                      }}
                      placeholder="ABC123"
                      style={{
                        paddingLeft: "44px",
                        height: "56px",
                        textAlign: "center",
                        letterSpacing: "0.2em",
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        borderRadius: "16px",
                        border: "2px solid var(--border)",
                        background: "rgba(255, 255, 255, 0.7)",
                        color: "var(--primary)"
                      }}
                      maxLength={ROOM_CODE_LENGTH}
                    />
                  </div>
                </div>

                {error && (
                  <div 
                    className="alert alert-error" 
                    style={{ 
                      borderRadius: "14px",
                      padding: "12px 16px",
                      fontSize: "0.9rem",
                      animation: "shake 0.4s ease-in-out"
                    }}
                  >
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block"
                  style={{ 
                    marginTop: 12,
                    height: "60px",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    borderRadius: "18px",
                    boxShadow: "0 10px 25px -5px rgba(30, 58, 138, 0.4)"
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><div className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} /> Joining...</>
                  ) : (
                    "Enter Arena"
                  )}
                </button>
              </form>

              <div style={{ marginTop: "32px", textAlign: "center", display: "flex", flexDirection: "column", gap: "12px" }}>
                <Link 
                  href="/" 
                  style={{ 
                    fontSize: "0.9rem", 
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "color 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  ← Go back home
                </Link>
                
                {isAuthenticated() && (
                  <div style={{ marginTop: "8px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                      Want to host instead?
                    </p>
                    <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ borderRadius: "12px" }}>
                      Create a Room
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
