"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";

export function PrivateBetaGate({ configured }: { configured: boolean }) {
  return (
    <main className="min-h-screen bg-black px-5 py-6 text-white sm:px-8 sm:py-10">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl place-items-center rounded-[32px] border border-[#242020] bg-[#111212] p-7 sm:p-12">
        <div className="max-w-xl text-center">
          <ShieldCheck className="mx-auto h-9 w-9 text-[#fc74dd]" aria-hidden="true" />
          <p className="mono mt-9 text-[11px] uppercase tracking-[0.16em] text-[#fc74dd]">Private beta</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">A quieter place to check what is ready.</h1>
          <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-[#b8b3b3]">
            Vibe is currently available to invited testers. Sign in with the Google account that received your beta access.
          </p>
          {configured ? (
            <button
              onClick={() => void signIn("google", { callbackUrl: "/" })}
              className="mono mt-9 inline-flex items-center gap-2 rounded-full bg-[#fc74dd] px-6 py-3 text-[11px] text-black transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Continue with Google
            </button>
          ) : (
            <p className="mt-9 rounded-2xl border border-[#4d363e] bg-[#24151b] px-5 py-4 text-sm leading-6 text-[#f2b8d9]">
              Sign-in is being configured. Please return once the beta administrator confirms access.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
