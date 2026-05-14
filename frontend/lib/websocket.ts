import { useWebSocketContext } from "./WebSocketContext";

/**
 * Hook to use the shared room WebSocket connection.
 * Now uses WebSocketContext internally to avoid multiple connections.
 */
export function useWebSocket(roomCode: string) {
    const context = useWebSocketContext();
    
    // We ignore roomCode here because it's managed by the layout's Provider
    // but we keep the signature for compatibility.
    
    return {
        players: context.players,
        isConnected: context.isConnected,
        sendEvent: context.sendEvent,
        disconnect: context.disconnect,
        error: context.error,
        ws: context.ws,
        lastMessage: context.lastMessage,
        gameState: context.gameState
    };
}
