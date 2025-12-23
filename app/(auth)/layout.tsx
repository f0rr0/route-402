import type { ReactNode } from "react";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-auth-sans",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-auth-mono",
  weight: ["400", "500"],
});

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${plexMono.variable} min-h-screen font-(--font-auth-sans) text-zinc-100`}
    >
      <div className="relative min-h-screen overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(1100px_circle_at_10%_10%,rgba(16,185,129,0.22),transparent_45%),radial-gradient(900px_circle_at_90%_20%,rgba(59,130,246,0.18),transparent_40%),radial-gradient(1000px_circle_at_50%_80%,rgba(245,158,11,0.15),transparent_45%)]" />
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[32px_32px]" />
        <div className="auth-float absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="auth-float absolute bottom-10 right-10 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
