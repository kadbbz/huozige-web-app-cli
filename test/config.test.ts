import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { applyDefaults, loadConfig } from "../src/config/config";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("applies defaults when no env vars are set", () => {
    delete process.env.HZG_CLI_MQTT_BROKER;
    delete process.env.HZG_CLI_USERNAME;
    delete process.env.HZG_CLI_PASSWORD;
    delete process.env.HZG_CLI_REQUEST_TOPIC;
    delete process.env.HZG_CLI_RESPONSE_TOPIC;
    delete process.env.HZG_CLI_TIMEOUT;

    const config = loadConfig();

    expect(config.mqttBroker).toBeUndefined();
    expect(config.username).toBeUndefined();
    expect(config.requestTopic).toBe("openclaw/req");
    expect(config.responseTopic).toBe("openclaw/res");
    expect(config.timeout).toBe(200);
  });

  it("reads values from environment variables", () => {
    process.env.HZG_CLI_MQTT_BROKER = "ssl://broker.example.com:8883";
    process.env.HZG_CLI_USERNAME = "testuser";
    process.env.HZG_CLI_PASSWORD = "testpass";
    process.env.HZG_CLI_REQUEST_TOPIC = "custom/req";
    process.env.HZG_CLI_RESPONSE_TOPIC = "custom/res";
    process.env.HZG_CLI_TIMEOUT = "500";

    const config = loadConfig();

    expect(config.mqttBroker).toBe("ssl://broker.example.com:8883");
    expect(config.username).toBe("testuser");
    expect(config.password).toBe("testpass");
    expect(config.requestTopic).toBe("custom/req");
    expect(config.responseTopic).toBe("custom/res");
    expect(config.timeout).toBe(500);
  });

  it("env vars override defaults", () => {
    process.env.HZG_CLI_REQUEST_TOPIC = "my/req";
    process.env.HZG_CLI_RESPONSE_TOPIC = "my/res";
    process.env.HZG_CLI_TIMEOUT = "1000";

    const config = loadConfig();

    expect(config.requestTopic).toBe("my/req");
    expect(config.responseTopic).toBe("my/res");
    expect(config.timeout).toBe(1000);
  });

  it("ignores invalid timeout value", () => {
    process.env.HZG_CLI_TIMEOUT = "not-a-number";

    const config = loadConfig();

    expect(config.timeout).toBe(200); // falls back to default
  });

  it("ignores empty timeout value", () => {
    process.env.HZG_CLI_TIMEOUT = "";

    const config = loadConfig();

    expect(config.timeout).toBe(200); // falls back to default
  });
});

describe("applyDefaults", () => {
  it("fills in missing requestTopic, responseTopic, and timeout", () => {
    const config = applyDefaults({});

    expect(config.requestTopic).toBe("openclaw/req");
    expect(config.responseTopic).toBe("openclaw/res");
    expect(config.timeout).toBe(200);
  });

  it("does not overwrite existing values", () => {
    const config = applyDefaults({
      mqttBroker: "tcp://localhost:1883",
      timeout: 500
    });

    expect(config.mqttBroker).toBe("tcp://localhost:1883");
    expect(config.requestTopic).toBe("openclaw/req");
    expect(config.responseTopic).toBe("openclaw/res");
    expect(config.timeout).toBe(500);
  });
});
