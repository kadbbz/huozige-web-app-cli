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

const ENV_PREFIX = "HZG_CLI_";

const ENV_KEY_MAP: Record<keyof Config, string> = {
  mqttBroker: "MQTT_BROKER",
  username: "USERNAME",
  password: "PASSWORD",
  authServer: "AUTH_SERVER",
  commandServer: "COMMAND_SERVER",
  requestTopic: "REQUEST_TOPIC",
  responseTopic: "RESPONSE_TOPIC",
  timeout: "TIMEOUT",
};

function toEnvKey(configKey: keyof Config): string {
  return ENV_PREFIX + ENV_KEY_MAP[configKey];
}

export function loadConfig(): Config {
  const config: Config = {};

  const envMqttBroker = process.env[toEnvKey("mqttBroker")];
  if (envMqttBroker !== undefined) {
    config.mqttBroker = envMqttBroker;
  }

  const envUsername = process.env[toEnvKey("username")];
  if (envUsername !== undefined) {
    config.username = envUsername;
  }

  const envPassword = process.env[toEnvKey("password")];
  if (envPassword !== undefined) {
    config.password = envPassword;
  }

  const envAuthServer = process.env[toEnvKey("authServer")];
  if (envAuthServer !== undefined) {
    config.authServer = envAuthServer;
  }

  const envCommandServer = process.env[toEnvKey("commandServer")];
  if (envCommandServer !== undefined) {
    config.commandServer = envCommandServer;
  }

  const envRequestTopic = process.env[toEnvKey("requestTopic")];
  if (envRequestTopic !== undefined) {
    config.requestTopic = envRequestTopic;
  }

  const envResponseTopic = process.env[toEnvKey("responseTopic")];
  if (envResponseTopic !== undefined) {
    config.responseTopic = envResponseTopic;
  }

  const envTimeout = process.env[toEnvKey("timeout")];
  if (envTimeout !== undefined) {
    const parsed = Number(envTimeout);
    if (!Number.isNaN(parsed)) {
      config.timeout = parsed;
    }
  }

  return applyDefaults(config);
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
