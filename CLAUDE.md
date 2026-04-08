# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript rewrite of the Forguncy (活字格) Web App MQTT CLI. Exposes `servercommand`, `binding`, and `status` commands that send requests over MQTT to a Forguncy server. Strict protocol compatibility with the original Go version is maintained.

## Build and Test Commands

```bash
npm run build   # TypeScript compile (tsc) → dist/
npm run test    # Run unit tests via vitest
```

Test files live alongside source under `test/` and are included in the TypeScript compilation via `tsconfig.json`.

## Architecture

```
src/
├── cli.ts                  # Entry point, shebang script
├── index.ts                # Library export
├── commands/
│   └── root.ts             # All CLI logic: argument parsing, command dispatch, help rendering
├── client/
│   └── mqtt-client.ts      # MQTT connection, pub/sub, request/response correlation via traceId
├── config/
│   └── config.ts          # JSON config loading and defaults
└── protocol/
    └── messages.ts         # Request/Response TypeScript types
```

**CLI flow**: `cli.ts` → `root.ts:runCli()` parses global flags (`-c`) and delegates to `executeServerCommand`, `executeBindingCommand`, or `executeStatus`. Both command variants call `sendCommand()`, which creates an `MQTTClient`, subscribes to a unique response topic per traceId, publishes the request, and awaits the response.

**MQTT protocol**: Requests use `{ traceId, command, userName, sessionId, agentName, parameters, timestamp }`. Responses are either wrapped (`{ code, message, data }`) or raw JSON. The response topic is `{responseTopic}/{traceId}` so multiple in-flight requests are correlated correctly.

**Config defaults** (`config.ts:applyDefaults`): `requestTopic = "openclaw/req"`, `responseTopic = "openclaw/res"`, `timeout = 200ms`.

**Binding command normalization** (`root.ts:normalizeBindingCommandName`): Accepts aliases like `tablebinding`, `candidatesbinding` and maps them to the server-side names `GetTableDataWithOffset` and `GetComboBindingOptions`. Only these two binding endpoints are allowed.

## Key Constraints

- MQTT broker URL supports `tcp://`, `ssl://`, bare `host:port`, IPv6, WebSocket (`ws://`/`wss://`) via `mqtt-client.ts:normalizeBroker()`.
- Tests mock `MQTTClient` via dependency injection (`io: CliIO` abstraction in `root.ts` allows stdout/stderr capture without mocks).
