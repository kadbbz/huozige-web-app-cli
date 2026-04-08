"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG_FILE_NAME = void 0;
exports.defaultConfigPath = defaultConfigPath;
exports.loadConfig = loadConfig;
exports.applyDefaults = applyDefaults;
const promises_1 = require("node:fs/promises");
exports.DEFAULT_CONFIG_FILE_NAME = "config.json";
function defaultConfigPath() {
    return exports.DEFAULT_CONFIG_FILE_NAME;
}
async function loadConfig(configPath = defaultConfigPath()) {
    let rawConfig;
    try {
        rawConfig = await (0, promises_1.readFile)(configPath, "utf8");
    }
    catch (error) {
        throw new Error(`failed to read config file "${configPath}": ${formatErrorMessage(error)}`);
    }
    let parsedConfig;
    try {
        parsedConfig = JSON.parse(rawConfig);
    }
    catch (error) {
        throw new Error(`failed to parse config file "${configPath}": ${formatErrorMessage(error)}`);
    }
    return applyDefaults(parsedConfig);
}
function applyDefaults(config) {
    const nextConfig = { ...config };
    if (!nextConfig.requestTopic) {
        nextConfig.requestTopic = "openclaw/req";
    }
    if (!nextConfig.responseTopic) {
        nextConfig.responseTopic = "openclaw/res";
    }
    if (!nextConfig.timeout) {
        nextConfig.timeout = 200;
    }
    return nextConfig;
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
