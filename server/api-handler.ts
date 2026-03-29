import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";

export default async function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => {
      const pin = req.headers.get("x-admin-pin") ?? undefined;
      return { adminPin: pin };
    },
  });
}
