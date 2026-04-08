"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mqtt_client_1 = require("../src/client/mqtt-client");
(0, vitest_1.describe)("parseResponsePayload", () => {
    (0, vitest_1.it)("parses wrapped response", () => {
        const response = (0, mqtt_client_1.parseResponsePayload)('{"code":0,"data":{"ok":true}}');
        (0, vitest_1.expect)(response.code).toBe(0);
        (0, vitest_1.expect)(response.data).toEqual({ ok: true });
    });
    (0, vitest_1.it)("parses raw array as success response", () => {
        const response = (0, mqtt_client_1.parseResponsePayload)('[{"id":1},{"id":2}]');
        (0, vitest_1.expect)(response.code).toBe(0);
        (0, vitest_1.expect)(response.data).toEqual([{ id: 1 }, { id: 2 }]);
    });
    (0, vitest_1.it)("parses raw object as success response", () => {
        const response = (0, mqtt_client_1.parseResponsePayload)('{"rows":[1,2,3]}');
        (0, vitest_1.expect)(response.code).toBe(0);
        (0, vitest_1.expect)(response.data).toEqual({ rows: [1, 2, 3] });
    });
    (0, vitest_1.it)("recognizes wrapped response by key presence", () => {
        (0, vitest_1.expect)((0, mqtt_client_1.isWrappedResponse)({ correlationId: "abc" })).toBe(true);
        (0, vitest_1.expect)((0, mqtt_client_1.isWrappedResponse)({ rows: [1, 2, 3] })).toBe(false);
    });
});
