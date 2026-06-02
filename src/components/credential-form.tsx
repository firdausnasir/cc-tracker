"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup";

type Props = {
  mode: Mode;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

const COPY = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to see what you owe this cycle.",
    cta: "Sign in",
    altText: "Need an account?",
    altHref: "/signup",
    altLink: "Create one",
  },
  signup: {
    title: "Create your account",
    subtitle: "Track what you owe across your cards. Takes a minute.",
    cta: "Create account",
    altText: "Already registered?",
    altHref: "/signin",
    altLink: "Sign in",
  },
} as const;

export function CredentialForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const copy = COPY[mode];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      {mode === "signup" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name (optional)</Label>
          <Input id="name" name="name" type="text" autoComplete="name" className="h-9" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="h-9"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="mt-1 w-full active:scale-[0.98]"
      >
        {pending ? "Working…" : copy.cta}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {copy.altText}{" "}
        <Link href={copy.altHref} className="font-medium text-primary hover:underline">
          {copy.altLink}
        </Link>
      </p>
    </form>
  );
}
