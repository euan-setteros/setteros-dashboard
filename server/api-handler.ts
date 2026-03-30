import { nodeHTTPRequestHandler } from "@trpc/server/adapters/node-http";
import { appRouter } from "./routers";
import type { IncomingMessage, ServerResponse } from "http";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";
  // Extract procedure path: /api/trpc/leaderboard.weekly?... → leaderboard.weekly
  const path = url.replace(/^\/api\/trpc\/?/, "").split("?")[0];

  return nodeHTTPRequestHandler({
    router: appRouter,
    path,
    req,
    res,
    createContext: () => ({
      adminPin: req.headers["x-admin-pin"] as string | undefined,
    }),
  });
}
