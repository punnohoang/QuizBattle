"use client";

import { use } from "react";
import { WebSocketProvider } from "@/lib/WebSocketContext";

export default function RoomLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <WebSocketProvider roomCode={code}>
      {children}
    </WebSocketProvider>
  );
}
