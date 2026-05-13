"use client";

export function QuizCardSkeleton() {
    return (
        <div
            className="quiz-card"
            style={{
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                opacity: 0.6,
            }}
        >
            {/* Badges skeleton */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div
                    style={{
                        width: 80,
                        height: 20,
                        borderRadius: 999,
                        background: "var(--border)",
                    }}
                />
                <div
                    style={{
                        width: 100,
                        height: 20,
                        borderRadius: 999,
                        background: "var(--border)",
                    }}
                />
            </div>

            {/* Title skeleton */}
            <div
                style={{
                    height: 24,
                    borderRadius: 6,
                    background: "var(--border)",
                    marginBottom: 12,
                    width: "85%",
                }}
            />

            {/* Description skeleton */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                <div
                    style={{
                        height: 16,
                        borderRadius: 4,
                        background: "var(--border)",
                        width: "100%",
                    }}
                />
                <div
                    style={{
                        height: 16,
                        borderRadius: 4,
                        background: "var(--border)",
                        width: "70%",
                    }}
                />
            </div>

            {/* Meta skeleton */}
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div
                    style={{
                        height: 14,
                        borderRadius: 4,
                        background: "var(--border)",
                        width: 120,
                    }}
                />
                <div
                    style={{
                        height: 14,
                        borderRadius: 4,
                        background: "var(--border)",
                        width: 100,
                    }}
                />
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

            {/* Buttons skeleton */}
            <div style={{ display: "flex", gap: 8 }}>
                <div
                    style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 6,
                        background: "var(--border)",
                    }}
                />
                <div
                    style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 6,
                        background: "var(--border)",
                    }}
                />
            </div>
        </div>
    );
}

export function QuizGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
            }}
        >
            {Array.from({ length: count }).map((_, i) => (
                <QuizCardSkeleton key={i} />
            ))}
        </div>
    );
}
