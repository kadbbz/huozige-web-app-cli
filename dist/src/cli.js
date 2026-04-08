#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const root_1 = require("./commands/root");
void (async () => {
    const exitCode = await (0, root_1.runCli)(process.argv.slice(2));
    process.exit(exitCode);
})();
