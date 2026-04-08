#!/usr/bin/env node

import { runCli } from "./commands/root";

void (async () => {
  const exitCode = await runCli(process.argv.slice(2));
  process.exit(exitCode);
})();
