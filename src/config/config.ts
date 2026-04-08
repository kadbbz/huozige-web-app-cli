import { readFile } from "node:fs/promises";

export interface Config {
  mqttBroker?: string;
  username?: string;
  password?: string;
  authServer?: string;
  commandServer?: string;
  requestTopic?: string;
  responseTopic?: string;
  timeout?: number;
}

export const DEFAULT_CONFIG_FILE_NAME = "config.json";

export function defaultConfigPath(): string {
  return DEFAULT_CONFIG_FILE_NAME;
}

export async function loadConfig(configPath = defaultConfigPath()): Promise<Config> {
  let rawConfig: string;
  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (error) {
    throw new Error(`failed to read config file "${configPath}": ${formatErrorMessage(error)}`);
  }

  let parsedConfig: Config;
  try {
    parsedConfig = JSON.parse(rawConfig) as Config;
  } catch (error) {
    throw new Error(`failed to parse config file "${configPath}": ${formatErrorMessage(error)}`);
  }

  return applyDefaults(parsedConfig);
}

export function applyDefaults(config: Config): Config {
  const nextConfig: Config = { ...config };

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

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
