import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/config";

describe("loadConfig", () => {
  it("applies defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "huozige-config-"));
    const configPath = join(dir, "config.json");
    await writeFile(configPath, '{"mqttBroker":"tcp://localhost:1883","username":"tester"}', "utf8");

    const config = await loadConfig(configPath);

    expect(config.mqttBroker).toBe("tcp://localhost:1883");
    expect(config.requestTopic).toBe("forguncy/req");
    expect(config.responseTopic).toBe("forguncy/res");
    expect(config.timeout).toBe(200);
  });

  it("throws when config file is missing", async () => {
    await expect(loadConfig(join(tmpdir(), "missing-config.json"))).rejects.toThrow(
      "failed to read config file"
    );
  });
});
