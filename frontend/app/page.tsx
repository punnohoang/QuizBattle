import Link from "next/link";
import Navbar from "./components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px 60px",
          textAlign: "center",
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(59,130,246,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(30,58,138,0.06) 0%, transparent 50%)",
        }}
      >
        {/* Pill badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 16px",
            borderRadius: 999,
            background: "var(--primary-muted)",
            border: "1px solid var(--accent-light)",
            color: "var(--primary)",
            fontWeight: 600,
            fontSize: "0.8rem",
            marginBottom: 24,
            letterSpacing: "0.04em",
          }}
        >
          🎮 Real-Time Multiplayer Quiz Platform
        </div>

        <h1
          style={{
            fontSize: "clamp(2.2rem, 6vw, 4rem)",
            fontWeight: 900,
            lineHeight: 1.15,
            marginBottom: 20,
            color: "var(--text-primary)",
          }}
        >
          Challenge Friends,{" "}
          <span className="gradient-text">Test Your Knowledge</span>
        </h1>

        <p
          style={{
            fontSize: "1.15rem",
            color: "var(--text-secondary)",
            marginBottom: 36,
            lineHeight: 1.75,
            maxWidth: 540,
          }}
        >
          Create custom quizzes, host live game rooms, and compete with friends in
          real-time multiplayer quiz battles.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/join" className="btn btn-primary btn-lg" style={{ minWidth: 180 }}>
            🎯 Join Game
          </Link>
          <Link href="/register" className="btn btn-secondary btn-lg" style={{ minWidth: 180 }}>
            🚀 Create Free Account
          </Link>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 32,
            marginTop: 48,
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            fontWeight: 500,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { label: "Players Online", value: "1,200+" },
            { label: "Quizzes Created", value: "8,400+" },
            { label: "Games Played", value: "24,000+" },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>
                {stat.value}
              </div>
              <div style={{ marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "60px 24px", background: "var(--surface)" }}>
        <div className="container" style={{ maxWidth: 1000 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
              Everything you need to quiz together
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
              Simple to set up, thrilling to play.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                emoji: "⚡",
                title: "Real-Time Play",
                desc: "WebSocket-powered live gameplay — answers are submitted instantly, no refresh needed.",
                color: "#dbeafe",
                iconColor: "#2563eb",
              },
              {
                emoji: "🎓",
                title: "Custom Quizzes",
                desc: "Build quizzes with multiple-choice questions, categories, and time limits.",
                color: "#d1fae5",
                iconColor: "#059669",
              },
              {
                emoji: "🏆",
                title: "Live Leaderboard",
                desc: "Score dynamically as players answer. See rankings update in real time.",
                color: "#fef3c7",
                iconColor: "#d97706",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="card"
                style={{ textAlign: "center", cursor: "default", padding: "2rem 1.5rem" }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 16,
                    background: f.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.75rem",
                    margin: "0 auto 16px",
                  }}
                >
                  {f.emoji}
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Banner */}
      <div
        style={{
          background: "var(--gradient-primary)",
          padding: "56px 24px",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "white", fontSize: "2rem", fontWeight: 800, marginBottom: 12 }}>
          Ready to battle?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginBottom: 28, fontSize: "1rem" }}>
          Create a free account and start your first quiz in minutes.
        </p>
        <Link
          href="/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 32px",
            borderRadius: 12,
            background: "white",
            color: "var(--primary)",
            fontWeight: 700,
            fontSize: "1rem",
            textDecoration: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            transition: "transform 0.2s",
          }}
        >
          🎮 Create Free Account
        </Link>
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "1.5rem 0",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.875rem",
          background: "var(--surface)",
        }}
      >
        <div className="container">
          <p>© 2026 QuizBattle. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
