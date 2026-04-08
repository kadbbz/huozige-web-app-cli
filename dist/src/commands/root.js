"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowedBindingEndpoints = void 0;
exports.runCli = runCli;
exports.executeServerCommand = executeServerCommand;
exports.executeBindingCommand = executeBindingCommand;
exports.parseBindingArgs = parseBindingArgs;
exports.parseJSONBody = parseJSONBody;
exports.parseJSONStringMap = parseJSONStringMap;
exports.sendCommand = sendCommand;
exports.executeStatus = executeStatus;
const node_path_1 = require("node:path");
const mqtt_client_1 = require("../client/mqtt-client");
const config_1 = require("../config/config");
exports.allowedBindingEndpoints = [
    "GetTableDataWithOffset",
    "GetComboBindingOptions",
    "CalcBindingDataSource"
];
const defaultIO = {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message)
};
async function runCli(argv, io = defaultIO) {
    try {
        const { configPath, restArgs, showHelp } = parseGlobalFlags(argv);
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
                return executeServerCommandFromCli(configPath, commandArgs, io);
            case "binding":
                if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
                    io.stdout(renderBindingCommandHelp());
                    return 0;
                }
                return executeBindingCommandFromCli(configPath, commandArgs, io);
            case "status":
                if (commandArgs.includes("--help") || commandArgs.includes("-h")) {
                    io.stdout(renderStatusHelp());
                    return 0;
                }
                if (commandArgs.length > 0) {
                    throw new Error(`accepts 0 arg(s), received ${commandArgs.length}`);
                }
                return executeStatusFromCli(configPath, io);
            default:
                throw new Error(`unknown command "${commandName}" for "fgc-web"`);
        }
    }
    catch (error) {
        const cliError = normalizeCliError(error);
        io.stderr(`Error: ${cliError.message}\n`);
        return cliError.exitCode;
    }
}
async function executeServerCommand(config, args, userName, sessionId, agentName, io = defaultIO) {
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
    const parameters = {
        applicationName,
        commandName,
        method: httpType
    };
    if (paramString) {
        if (httpType === "POST") {
            parameters.body = parseJSONBody(paramString, "body");
        }
        else {
            const query = parseJSONStringMap(paramString, "query");
            if (Object.keys(query).length > 0) {
                parameters.query = query;
            }
        }
    }
    await sendCommand(config, "servercommand", userName, sessionId, agentName, parameters, io);
}
async function executeBindingCommand(config, args, userName, sessionId, agentName, io = defaultIO) {
    const { applicationName, commandName, method, jsonBody } = parseBindingArgs(args);
    const body = parseJSONBody(jsonBody, "body");
    await sendCommand(config, "binding", userName, sessionId, agentName, {
        applicationName,
        commandName,
        method,
        body
    }, io);
}
function parseBindingArgs(args) {
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
        throw new Error(`unsupported binding commandName: ${rawCommandName} (allowed: ${exports.allowedBindingEndpoints.join(", ")})`);
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
function normalizeBindingCommandName(commandName) {
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
        case "calcbindingdatasource":
            return "CalcBindingDataSource";
        default:
            return undefined;
    }
}
function parseJSONBody(raw, targetName) {
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`invalid JSON param for ${targetName}`);
    }
}
function parseJSONStringMap(raw, targetName) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
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
    return Object.fromEntries(entries);
}
async function sendCommand(config, command, userName, sessionId, agentName, parameters, io = defaultIO) {
    if (!config.mqttBroker) {
        throw new Error("mqttBroker not configured in local config file");
    }
    const mqttClient = new mqtt_client_1.MQTTClient(config.mqttBroker, "forguncy-cli", config.username ?? "", config.password ?? "");
    mqttClient.setTopics(config.requestTopic ?? "", config.responseTopic ?? "");
    try {
        await mqttClient.connect();
    }
    catch (error) {
        throw new Error(`failed to connect to MQTT broker: ${formatErrorMessage(error)}`);
    }
    let response;
    try {
        response = await mqttClient.sendRequest(command, userName, sessionId, agentName, parameters, (config.timeout ?? 0) * 1_000);
    }
    finally {
        await mqttClient.disconnect();
    }
    if (response.code !== 0) {
        throw new CliError(response.message ?? "", response.code > 0 ? response.code : 1);
    }
    if (response.data !== undefined && response.data !== null) {
        io.stdout(`${JSON.stringify(response.data, null, 2)}\n`);
    }
}
function executeStatus(config, configPath, io = defaultIO) {
    io.stdout("Configuration Status\n");
    io.stdout(`Config File: ${(0, node_path_1.resolve)(configPath)}\n`);
    if (config.mqttBroker) {
        io.stdout(`MQTT Broker: ${config.mqttBroker}\n`);
    }
    else {
        io.stdout("MQTT Broker: (not set)\n");
    }
    if (config.username) {
        io.stdout(`Username: ${config.username}\n`);
    }
    if (config.timeout && config.timeout > 0) {
        io.stdout(`Timeout: ${config.timeout} seconds\n`);
    }
    io.stdout("\nCommands:\n");
    io.stdout("  servercommand: business command endpoint\n");
    io.stdout("  binding: system built-in binding endpoint\n");
    io.stdout(`  binding allowed endpoints: ${exports.allowedBindingEndpoints.join(", ")}\n`);
}
async function executeServerCommandFromCli(configPath, commandArgs, io) {
    const { positionalArgs, flags } = parseUserFlags(commandArgs);
    assertRequiredUserFlags(flags);
    const config = await (0, config_1.loadConfig)(configPath);
    await executeServerCommand(config, positionalArgs, flags.userName, flags.sessionId, flags.agentName, io);
    return 0;
}
async function executeBindingCommandFromCli(configPath, commandArgs, io) {
    const { positionalArgs, flags } = parseUserFlags(commandArgs);
    assertRequiredUserFlags(flags);
    const config = await (0, config_1.loadConfig)(configPath);
    await executeBindingCommand(config, positionalArgs, flags.userName, flags.sessionId, flags.agentName, io);
    return 0;
}
async function executeStatusFromCli(configPath, io) {
    const config = await (0, config_1.loadConfig)(configPath);
    executeStatus(config, configPath, io);
    return 0;
}
function parseGlobalFlags(argv) {
    let configPath = (0, config_1.defaultConfigPath)();
    let showHelp = false;
    const restArgs = [];
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "-c" || token === "--config") {
            const value = argv[index + 1];
            if (!value) {
                throw new Error(`flag needs an argument: ${token}`);
            }
            configPath = value;
            index += 1;
            continue;
        }
        if (token === "-h" || token === "--help") {
            showHelp = true;
            continue;
        }
        restArgs.push(token);
    }
    return {
        configPath,
        restArgs,
        showHelp
    };
}
function parseUserFlags(args) {
    const positionalArgs = [];
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
function assertRequiredUserFlags(flags) {
    const missingFlags = [];
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
function requireFlagValue(flagName, value) {
    if (!value) {
        throw new Error(`flag needs an argument: ${flagName}`);
    }
    return value;
}
function renderRootHelp() {
    return [
        "Forguncy CLI tool",
        "",
        "Usage:",
        "  fgc-web [command]",
        "",
        "Available Commands:",
        "  servercommand Execute business server command",
        "  binding       Execute system binding endpoint",
        "  status        Show configuration status",
        "  help          Help about any command",
        "",
        "Flags:",
        '  -c, --config string   Path to local JSON config file (default "config.json")',
        "  -h, --help            help for fgc-web",
        ""
    ].join("\n");
}
function renderServerCommandHelp() {
    return [
        "Execute business server command",
        "",
        "Usage:",
        "  fgc-web servercommand [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]",
        "",
        "Flags:",
        "  -u, --userName string    Username for authentication",
        "  -s, --sessionId string   Session ID for authentication",
        "  -a, --agentName string   Agent name for request",
        ""
    ].join("\n");
}
function renderBindingCommandHelp() {
    return [
        "Execute system binding endpoint",
        "",
        "Usage:",
        "  fgc-web binding [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]",
        "",
        "Flags:",
        "  -u, --userName string    Username for authentication",
        "  -s, --sessionId string   Session ID for authentication",
        "  -a, --agentName string   Agent name for request",
        ""
    ].join("\n");
}
function renderStatusHelp() {
    return [
        "Show configuration status",
        "",
        "Usage:",
        "  fgc-web status",
        ""
    ].join("\n");
}
function renderHelpByCommand(commandName) {
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
function normalizeCliError(error) {
    if (error instanceof CliError) {
        return error;
    }
    return new CliError(formatErrorMessage(error), 1);
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
class CliError extends Error {
    exitCode;
    constructor(message, exitCode = 1) {
        super(message);
        this.exitCode = exitCode;
    }
}
