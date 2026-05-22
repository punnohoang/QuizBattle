import type { Metadata } from "next";
import "./globals.css";
import AuthInitializer from "./components/AuthInitializer";

export const metadata: Metadata = {
  title: "QuizBattle | Multiplayer Quiz Arena",
  description: "Real-time multiplayer quiz platform. Challenge friends, test your knowledge, and climb the leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthInitializer />
        {children}
      </body>
    </html>
  );
}
