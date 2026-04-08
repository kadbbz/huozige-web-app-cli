"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const config_1 = require("../src/config/config");
(0, vitest_1.describe)("loadConfig", () => {
    (0, vitest_1.it)("applies defaults", async () => {
        const dir = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "huozige-config-"));
        const configPath = (0, node_path_1.join)(dir, "config.json");
        await (0, promises_1.writeFile)(configPath, '{"mqttBroker":"tcp://localhost:1883","username":"tester"}', "utf8");
        const config = await (0, config_1.loadConfig)(configPath);
        (0, vitest_1.expect)(config.mqttBroker).toBe("tcp://localhost:1883");
        (0, vitest_1.expect)(config.requestTopic).toBe("forguncy/req");
        (0, vitest_1.expect)(config.responseTopic).toBe("forguncy/res");
        (0, vitest_1.expect)(config.timeout).toBe(200);
    });
    (0, vitest_1.it)("throws when config file is missing", async () => {
        await (0, vitest_1.expect)((0, config_1.loadConfig)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "missing-config.json"))).rejects.toThrow("failed to read config file");
    });
});
