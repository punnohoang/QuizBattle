import { useEffect, useState, useRef, useCallback } from "react";
import { getWsUrl } from "@/lib/api";
import type { WSEvent, WSPlayer } from "@/lib/types";

export function useWebSocket(roomCode: string) {
    const [players, setPlayers] = useState<WSPlayer[]>([]);
    const [error, setError] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomCode) return;

        try {
            const wsUrl = getWsUrl(roomCode);
            console.log("🔌 Creating WebSocket:", wsUrl.replace(/token=.+$/, "token=***"));
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("✅ WebSocket connected to room", roomCode);
                setIsConnected(true);
                setError("");
            };

            socket.onmessage = (event) => {
                try {
                    const data: WSEvent = JSON.parse(event.data);
                    console.log("📨 WS event:", data.event, data);

                    if (data.participants) {
                        console.log(`👥 Updated players: ${data.participants.length}`, data.participants);
                        setPlayers(data.participants);
                    }
                } catch (err) {
                    console.error("❌ Failed to parse WS message", err);
                }
            };

            socket.onerror = (event) => {
                console.error("❌ WebSocket error:", event);
                setError("Failed to connect to game room. Please try again.");
                setIsConnected(false);
            };

            socket.onclose = (event) => {
                console.log("🔌 WebSocket closed", { code: event.code, reason: event.reason });
                setIsConnected(false);
            };

            wsRef.current = socket;
        } catch (err) {
            console.error("❌ WebSocket connection error:", err);
            setError("Failed to connect to game room.");
            setIsConnected(false);
        }

        return () => {
            if (wsRef.current) {
                console.log("🧹 Cleaning up WebSocket");
                wsRef.current.close();
            }
        };
    }, [roomCode]);

    const sendEvent = useCallback((event: WSEvent) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(event));
        } else {
            console.error("WebSocket not connected");
        }
    }, []);

    const disconnect = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }
    }, []);

    return {
        players,
        isConnected,
        sendEvent,
        disconnect,
        error,
        ws: wsRef.current,
    };
}
