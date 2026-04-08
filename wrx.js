import { runWrxCli } from "./wrx.ts";

export * from "./wrx.ts";

if (import.meta.main) {
  await runWrxCli(process.argv.slice(2));
}
