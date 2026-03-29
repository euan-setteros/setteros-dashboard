import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Middleware that checks the x-admin-pin header against the ADMIN_PIN env var */
const requirePin = t.middleware(async ({ next, ctx }) => {
  const pin = (ctx as any).adminPin as string | undefined;
  const expected = process.env.ADMIN_PIN;

  if (!expected || pin !== expected) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin PIN" });
  }

  return next();
});

export const adminProcedure = t.procedure.use(requirePin);
