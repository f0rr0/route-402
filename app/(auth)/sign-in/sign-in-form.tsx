"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const rememberMe = formData.get("rememberMe") === "on";

    if (!email || !password) {
      setError("Email and password are required.");
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await authClient.signIn.email(
      {
        email,
        password,
        rememberMe,
        callbackURL: "/post-auth",
      },
      {
        onError: (ctx) => {
          setError(ctx.error.message);
        },
      }
    );

    if (!signInError) {
      router.push("/post-auth");
    }

    setIsSubmitting(false);
  };

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="auth-fade-up auth-delay-1 flex flex-col justify-between gap-10">
        <div className="space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-emerald-200"
          >
            Route402
          </Link>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              Welcome back to your routing console.
            </h1>
            <p className="max-w-xl text-base text-zinc-300 sm:text-lg">
              Sign in to manage facilitator connections, validate capabilities,
              and tune routing rules without touching your app servers.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Live facade
              </p>
              <Badge variant="success">Operational</Badge>
            </div>
            <div className="mt-4 space-y-2 font-[var(--font-auth-mono)] text-sm text-emerald-100">
              <div>POST /api/facilitator/verify</div>
              <div>POST /api/facilitator/settle</div>
              <div>GET /api/facilitator/supported</div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Sticky settle
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                Deterministic routing per fingerprint.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Capability aware
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                Eligible routes only, no surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-fade-up auth-delay-2 flex items-center">
        <Card className="w-full border-white/10 bg-white/95 text-zinc-900 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.9)]">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Use your email and password to access Route402.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <span className="text-xs text-zinc-500">Min 8 chars</span>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" name="rememberMe" defaultChecked />
                Keep me signed in
              </label>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-zinc-600">
              New to Route402?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-zinc-900 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
