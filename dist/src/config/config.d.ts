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
export declare const DEFAULT_CONFIG_FILE_NAME = "config.json";
export declare function defaultConfigPath(): string;
export declare function loadConfig(configPath?: string): Promise<Config>;
export declare function applyDefaults(config: Config): Config;
