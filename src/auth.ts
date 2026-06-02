import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { getPrisma } from "@/lib/prisma";
import { signinSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT (stateless) sessions — required for the Credentials provider and
  // friendly to Vercel serverless (no session table round-trips).
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  // Self-host needs this; Vercel sets it automatically.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = signinSchema.safeParse(raw);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const prisma = await getPrisma();
        const user = await prisma.user.findUnique({ where: { email } });

        // Compare against a found hash, or a throwaway one, to keep the
        // timing roughly constant whether or not the email exists.
        const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv";
        const ok = await bcrypt.compare(password, hash);

        if (!user || !ok) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
});
