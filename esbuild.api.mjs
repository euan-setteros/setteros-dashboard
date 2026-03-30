import { build } from "esbuild";

await build({
  entryPoints: ["server/api-handler.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/trpc/[...path].js",
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
  external: [],
});

console.log("API function bundled to api/trpc.js");
