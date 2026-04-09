import { MQTTClient } from "../client/mqtt-client";
import { loadConfig, type Config } from "../config/config";
import type { CommandParameters, Response } from "../protocol/messages";

export const allowedBindingEndpoints = [
  "TableBinding",
  "GetTableDataWithOffset",
  "CandidatesBinding",
  "GetComboBindingOptions"
] as const;

export interface CliIO {
  stdout(message: string): void;
  stderr(message: string): void;
}

const defaultIO: CliIO = {
  stdout: (message) => process.stdout.write(message),
  stderr: (message) => process.stderr.write(message)
};

export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  try {
    const { restArgs, showHelp } = parseGlobalFlags(argv);

    if (showHelp || restArgs.length === 0) {
      io.stdout(renderRootHelp());
      return 0;
    }

    const [commandName, ...commandArgs] = restArgs;
    if (commandName === "help") {
      io.stdout(renderHelpByCommand(commandArgs[0]));
      return 0;
    }

    switch (commandName) {
      case "servercommand":
        if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
          io.stdout(renderServerCommandHelp());
          return 0;
        }

        return executeServerCommandFromCli(commandArgs, io);
      case "binding":
        if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
          io.stdout(renderBindingCommandHelp());
          return 0;
        }

        return executeBindingCommandFromCli(commandArgs, io);
      case "status":
        if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
          io.stdout(renderStatusHelp());
          return 0;
        }

        if (commandArgs.length > 0) {
          throw new Error(`accepts 0 arg(s), received ${commandArgs.length}`);
        }

        return executeStatusFromCli(io);
      default:
        throw new Error(`unknown command "${commandName}" for "fgc-web"`);
    }
  } catch (error) {
    const cliError = normalizeCliError(error);
    io.stderr(`Error: ${cliError.message}\n`);
    return cliError.exitCode;
  }
}

export async function executeServerCommand(
  config: Config,
  args: string[],
  userName: string,
  sessionId: string,
  agentName: string,
  io: CliIO = defaultIO
): Promise<void> {
  if (args.length < 3) {
    throw new Error("usage: fgc-web servercommand <applicationName> <commandName> <httpType> [jsonBody]");
  }

  const applicationName = args[0];
  const commandName = args[1];
  const httpType = args[2].toUpperCase();
  const paramString = args[3] ?? "";

  if (httpType !== "GET" && httpType !== "POST") {
    throw new Error(`httpType must be GET or POST, got: ${httpType}`);
  }

  const parameters: CommandParameters = {
    applicationName,
    commandName,
    method: httpType
  };

  if (paramString) {
    if (httpType === "POST") {
      parameters.body = parseJSONBody(paramString, "body");
    } else {
      const query = parseJSONStringMap(paramString, "query");
      if (Object.keys(query).length > 0) {
        parameters.query = query;
      }
    }
  }

  await sendCommand(config, "servercommand", userName, sessionId, agentName, parameters, io);
}

export async function executeBindingCommand(
  config: Config,
  args: string[],
  userName: string,
  sessionId: string,
  agentName: string,
  io: CliIO = defaultIO
): Promise<void> {
  const { applicationName, commandName, method, jsonBody } = parseBindingArgs(args);
  const body = parseJSONBody(jsonBody, "body");

  await sendCommand(
    config,
    "binding",
    userName,
    sessionId,
    agentName,
    {
      applicationName,
      commandName,
      method,
      body
    },
    io
  );
}

export function parseBindingArgs(args: string[]): {
  applicationName: string;
  commandName: string;
  method: string;
  jsonBody: string;
} {
  if (!args[0]?.trim()) {
    throw new Error("applicationName is required");
  }

  if (!args[1]?.trim()) {
    throw new Error("commandName is required");
  }

  if (!args[2]?.trim()) {
    throw new Error("method is required");
  }

  if (args.length < 4) {
    throw new Error("body is required");
  }

  const applicationName = args[0].trim();
  const rawCommandName = args[1].trim();
  const method = args[2].trim().toUpperCase();
  const jsonBody = args[3];
  const commandName = normalizeBindingCommandName(rawCommandName);

  if (!commandName) {
    throw new Error(
      `unsupported binding commandName: ${rawCommandName})`
    );
  }

  if (!method) {
    throw new Error("method is required");
  }

  return {
    applicationName,
    commandName,
    method,
    jsonBody
  };
}

function normalizeBindingCommandName(commandName: string): string | undefined {
  const normalizedCommandName = commandName.trim().toLowerCase();

  switch (normalizedCommandName) {
    case "candidatesbinding":
    case "candidatesbindings":
    case "getcombobindingoptions":
      return "GetComboBindingOptions";
    case "tablebinding":
    case "tablebindings":
    case "gettabledatawithoffset":
      return "GetTableDataWithOffset";
    default:
      return undefined;
  }
}

export function parseJSONBody(raw: string, targetName: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`invalid JSON param for ${targetName}`);
  }
}

export function parseJSONStringMap(raw: string, targetName: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`invalid JSON param for ${targetName}: ${formatErrorMessage(error)}`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`invalid JSON param for ${targetName}: expected JSON object`);
  }

  const entries = Object.entries(parsed);
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      throw new Error(`invalid JSON param for ${targetName}: key "${key}" must map to string`);
    }
  }

  return Object.fromEntries(entries) as Record<string, string>;
}

export async function sendCommand(
  config: Config,
  command: string,
  userName: string,
  sessionId: string,
  agentName: string,
  parameters: CommandParameters,
  io: CliIO = defaultIO
): Promise<void> {
  if (!config.mqttBroker) {
    throw new Error("HZG_CLI_MQTT_BROKER environment variable is required");
  }

  const mqttClient = new MQTTClient(
    config.mqttBroker,
    "",
    config.username ?? "",
    config.password ?? ""
  );

  mqttClient.setTopics(config.requestTopic ?? "", config.responseTopic ?? "");

  try {
    await mqttClient.connect();
  } catch (error) {
    throw new Error(`failed to connect to MQTT broker: ${formatErrorMessage(error)}`);
  }

  let response: Response;
  try {
    response = await mqttClient.sendRequest(
      command,
      userName,
      sessionId,
      agentName,
      parameters,
      (config.timeout ?? 0) * 1_000
    );
  } finally {
    await mqttClient.disconnect();
  }

  if (response.code !== 0) {
    throw new CliError(response.message ?? "", response.code > 0 ? response.code : 1);
  }

  if (response.data !== undefined && response.data !== null) {
    io.stdout(`${JSON.stringify(response.data, null, 2)}\n`);
  }
}

export function executeStatus(config: Config, io: CliIO = defaultIO): void {
  io.stdout("Configuration Status\n");

  if (config.mqttBroker) {
    io.stdout(`MQTT Broker: ${config.mqttBroker}\n`);
  } else {
    io.stdout("MQTT Broker: (not set)\n");
  }

  if (config.username) {
    io.stdout(`Username: ${config.username}\n`);
  }

  if (config.requestTopic) {
    io.stdout(`Request Topic: ${config.requestTopic}\n`);
  }

  if (config.responseTopic) {
    io.stdout(`Response Topic: ${config.responseTopic}\n`);
  }

  if (config.timeout && config.timeout > 0) {
    io.stdout(`Timeout: ${config.timeout} seconds\n`);
  }

  io.stdout("\nCommands:\n");
  io.stdout("  servercommand: business command endpoint\n");
  io.stdout("  binding: system built-in binding endpoint\n");
  io.stdout(`  binding allowed endpoints: ${allowedBindingEndpoints.join(", ")}\n`);
}

async function executeServerCommandFromCli(commandArgs: string[], io: CliIO): Promise<number> {
  const { positionalArgs, flags } = parseUserFlags(commandArgs);
  assertRequiredUserFlags(flags);
  const config = loadConfig();
  await executeServerCommand(config, positionalArgs, flags.userName, flags.sessionId, flags.agentName, io);
  return 0;
}

async function executeBindingCommandFromCli(commandArgs: string[], io: CliIO): Promise<number> {
  const { positionalArgs, flags } = parseUserFlags(commandArgs);
  assertRequiredUserFlags(flags);
  const config = loadConfig();
  await executeBindingCommand(config, positionalArgs, flags.userName, flags.sessionId, flags.agentName, io);
  return 0;
}

async function executeStatusFromCli(io: CliIO): Promise<number> {
  const config = loadConfig();
  executeStatus(config, io);
  return 0;
}

function parseGlobalFlags(argv: string[]): { restArgs: string[]; showHelp: boolean } {
  let showHelp = false;
  const restArgs: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "-h" || token === "--help") {
      showHelp = true;
      continue;
    }

    restArgs.push(token);
  }

  return {
    restArgs,
    showHelp
  };
}

function parseUserFlags(args: string[]): {
  positionalArgs: string[];
  flags: { userName: string; sessionId: string; agentName: string };
} {
  const positionalArgs: string[] = [];
  const flags = {
    userName: "",
    sessionId: "",
    agentName: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case "-u":
      case "--userName":
        flags.userName = requireFlagValue(token, args[index + 1]);
        index += 1;
        break;
      case "-s":
      case "--sessionId":
        flags.sessionId = requireFlagValue(token, args[index + 1]);
        index += 1;
        break;
      case "-a":
      case "--agentName":
        flags.agentName = requireFlagValue(token, args[index + 1]);
        index += 1;
        break;
      default:
        if (token.startsWith("-")) {
          throw new Error(`unknown flag: ${token}`);
        }

        positionalArgs.push(token);
        break;
    }
  }

  return {
    positionalArgs,
    flags
  };
}

function assertRequiredUserFlags(flags: {
  userName: string;
  sessionId: string;
  agentName: string;
}): void {
  const missingFlags: string[] = [];
  if (!flags.userName) {
    missingFlags.push("userName");
  }

  if (!flags.sessionId) {
    missingFlags.push("sessionId");
  }

  if (!flags.agentName) {
    missingFlags.push("agentName");
  }

  if (missingFlags.length > 0) {
    throw new Error(`required flag(s) "${missingFlags.join('", "')}" not set`);
  }
}

function requireFlagValue(flagName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`flag needs an argument: ${flagName}`);
  }

  return value;
}

function renderRootHelp(): string {
  return [
    "Huozige Web App CLI tool",
    "",
    "Usage:",
    "  huozige-web-app-cli [command]",
    "",
    "Available Commands:",
    "  servercommand Execute business server command",
    "  binding       Execute system binding endpoint",
    "  status        Show configuration status",
    "  help          Help about any command",
    "",
    "Flags:",
    "  -h, --help            help for huozige-web-app-cli",
    ""
  ].join("\n");
}

function renderServerCommandHelp(): string {
  return [
    "Execute business server command",
    "",
    "Usage:",
    "  huozige-web-app-cli servercommand [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]",
    "",
    "Flags:",
    "  -u, --userName string    Username for authentication",
    "  -s, --sessionId string   Session ID for authentication",
    "  -a, --agentName string   Agent name for request",
    ""
  ].join("\n");
}

function renderBindingCommandHelp(): string {
  return [
    "Execute system binding endpoint",
    "",
    "Usage:",
    "  huozige-web-app-cli binding [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]",
    "",
    "Flags:",
    "  -u, --userName string    Username for authentication",
    "  -s, --sessionId string   Session ID for authentication",
    "  -a, --agentName string   Agent name for request",
    ""
  ].join("\n");
}

function renderStatusHelp(): string {
  return [
    "Show configuration status",
    "",
    "Usage:",
    "  huozige-web-app-cli status",
    ""
  ].join("\n");
}

function renderHelpByCommand(commandName: string | undefined): string {
  switch (commandName) {
    case "servercommand":
      return renderServerCommandHelp();
    case "binding":
      return renderBindingCommandHelp();
    case "status":
      return renderStatusHelp();
    default:
      return renderRootHelp();
  }
}

function normalizeCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  return new CliError(formatErrorMessage(error), 1);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class CliError extends Error {
  public readonly exitCode: number;

  public constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}
