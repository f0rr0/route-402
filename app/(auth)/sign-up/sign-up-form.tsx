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

export default function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!name || !email || !password) {
      setError("Name, email, and password are required.");
      setIsSubmitting(false);
      return;
    }

    const { error: signUpError } = await authClient.signUp.email(
      {
        name,
        email,
        password,
        callbackURL: "/post-auth",
      },
      {
        onError: (ctx) => {
          setError(ctx.error.message);
        },
      }
    );

    if (!signUpError) {
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
            className="inline-flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-amber-200"
          >
            Route402
          </Link>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              Build smart routing for every x402 payment.
            </h1>
            <p className="max-w-xl text-base text-zinc-300 sm:text-lg">
              Join Route402 to connect Coinbase CDP and thirdweb Nexus, and
              control routing decisions through a lightweight YAML DSL.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Routing DSL
              </p>
              <Badge variant="warning">YAML</Badge>
            </div>
            <pre className="mt-4 whitespace-pre-wrap font-[var(--font-auth-mono)] text-xs text-amber-100">
{`default: "thirdweb-prod"
rules:
  - name: base-usdc
    when:
      all:
        - eq: [network, "base"]
        - eq: [asset, "USDC"]
    then:
      use: "cdp-base"`}
            </pre>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Encrypted creds
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                AES-256-GCM per project.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                RBAC enforced
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                Owner/admin/viewer roles.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-fade-up auth-delay-2 flex items-center">
        <Card className="w-full border-white/10 bg-white/95 text-zinc-900 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.9)]">
          <CardHeader>
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>
              Start routing with email and password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Sid J."
                  required
                />
              </div>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-zinc-600">
              Already have access?{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-zinc-900 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
