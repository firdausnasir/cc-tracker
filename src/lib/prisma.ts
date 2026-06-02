import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// The D1 binding is request-scoped on Workers, so we can't hold a single global
// client like we did with Postgres. Build one per request from the binding
// resolved out of the Cloudflare context.
export async function getPrisma(): Promise<PrismaClient> {
  const { env } = await getCloudflareContext({ async: true });
  const adapter = new PrismaD1(env.DB);

  return new PrismaClient({ adapter });
}
