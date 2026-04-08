"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const root_1 = require("../src/commands/root");
(0, vitest_1.describe)("parseBindingArgs", () => {
    (0, vitest_1.it)("accepts canonical binding command names", () => {
        const result = (0, root_1.parseBindingArgs)(["OASystem", "CalcBindingDataSource", "post", '{"a":1}']);
        (0, vitest_1.expect)(result).toEqual({
            applicationName: "OASystem",
            commandName: "CalcBindingDataSource",
            method: "POST",
            jsonBody: '{"a":1}'
        });
    });
    (0, vitest_1.it)("normalizes combo binding aliases to the MQTT command name", () => {
        const result = (0, root_1.parseBindingArgs)(["OASystem", "cAnDiDaTeSbInDiNgS", "post", '{"a":1}']);
        (0, vitest_1.expect)(result.commandName).toBe("GetComboBindingOptions");
    });
    (0, vitest_1.it)("normalizes table binding aliases to the MQTT command name", () => {
        const result = (0, root_1.parseBindingArgs)(["OASystem", "tablebinding", "post", '{"a":1}']);
        (0, vitest_1.expect)(result.commandName).toBe("GetTableDataWithOffset");
    });
    (0, vitest_1.it)("normalizes canonical command names without changing protocol casing", () => {
        const result = (0, root_1.parseBindingArgs)(["OASystem", "getcombobindingoptions", "post", '{"a":1}']);
        (0, vitest_1.expect)(result.commandName).toBe("GetComboBindingOptions");
    });
    (0, vitest_1.it)("rejects missing applicationName", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseBindingArgs)([])).toThrow("applicationName is required");
    });
    (0, vitest_1.it)("rejects missing commandName", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseBindingArgs)(["OASystem"])).toThrow("commandName is required");
    });
    (0, vitest_1.it)("rejects missing method", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseBindingArgs)(["OASystem", "CalcBindingDataSource"])).toThrow("method is required");
    });
    (0, vitest_1.it)("rejects missing body", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseBindingArgs)(["OASystem", "CalcBindingDataSource", "POST"])).toThrow("body is required");
    });
    (0, vitest_1.it)("rejects unsupported binding command", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseBindingArgs)(["OASystem", "UnknownBinding", "POST", '{"a":1}'])).toThrow(`unsupported binding commandName: UnknownBinding (allowed: ${root_1.allowedBindingEndpoints.join(", ")})`);
    });
});
(0, vitest_1.describe)("parseJSONBody", () => {
    (0, vitest_1.it)("accepts valid json", () => {
        (0, vitest_1.expect)((0, root_1.parseJSONBody)('{"CommandId":"x","Params":{}}', "body")).toEqual({
            CommandId: "x",
            Params: {}
        });
    });
    (0, vitest_1.it)("rejects invalid json", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseJSONBody)('{"CommandId":', "body")).toThrow("invalid JSON param for body");
    });
});
(0, vitest_1.describe)("parseJSONStringMap", () => {
    (0, vitest_1.it)("accepts object with string values", () => {
        (0, vitest_1.expect)((0, root_1.parseJSONStringMap)('{"userId":"123"}', "query")).toEqual({ userId: "123" });
    });
    (0, vitest_1.it)("rejects non-string values", () => {
        (0, vitest_1.expect)(() => (0, root_1.parseJSONStringMap)('{"userId":123}', "query")).toThrow('invalid JSON param for query: key "userId" must map to string');
    });
});
