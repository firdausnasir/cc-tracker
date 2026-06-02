"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";

import { signIn, signOut } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { signupSchema, signinSchema } from "@/lib/validation";

export type ActionState = { error: string } | null;

// Open registration: anyone can create an account. Accounts are isolated by
// userId at every query, so multiple users share the deployment safely. Email
// uniqueness is enforced by the DB constraint on User.email.
export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;
  const prisma = await getPrisma();

  // Friendly pre-check; the unique constraint below is the real floor and also
  // covers the race where two requests register the same email at once.
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({ data: { email, name, passwordHash } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "An account with this email already exists." };
    }

    throw error;
  }

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });

  return null;
}

export async function signinAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password" };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // next-auth throws a redirect internally on success — re-throw it.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }

    throw error;
  }

  return null;
}

export async function signoutAction(): Promise<void> {
  await signOut({ redirectTo: "/signin" });
}
