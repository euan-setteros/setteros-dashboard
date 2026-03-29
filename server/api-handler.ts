import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import type { IncomingMessage, ServerResponse } from "http";

const middleware = createExpressMiddleware({
  router: appRouter,
  createContext: ({ req }) => ({
    adminPin: req.headers["x-admin-pin"] as string | undefined,
  }),
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Strip the /api/trpc prefix so tRPC can match procedure names
  req.url = req.url?.replace(/^\/api\/trpc\/?/, "/") ?? req.url;
  return middleware(req as any, res as any, () => {
    res.statusCode = 404;
    res.end("Not found");
  });
}
