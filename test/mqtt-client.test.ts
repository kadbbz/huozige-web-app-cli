import { describe, expect, it } from "vitest";

import { isWrappedResponse, parseResponsePayload, MQTTClient } from "../src/client/mqtt-client";

describe("parseResponsePayload", () => {
  it("parses wrapped response", () => {
    const response = parseResponsePayload('{"code":0,"data":{"ok":true}}');

    expect(response.code).toBe(0);
    expect(response.data).toEqual({ ok: true });
  });

  it("parses raw array as success response", () => {
    const response = parseResponsePayload('[{"id":1},{"id":2}]');

    expect(response.code).toBe(0);
    expect(response.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("parses raw object as success response", () => {
    const response = parseResponsePayload('{"rows":[1,2,3]}');

    expect(response.code).toBe(0);
    expect(response.data).toEqual({ rows: [1, 2, 3] });
  });

  it("recognizes wrapped response by key presence", () => {
    expect(isWrappedResponse({ correlationId: "abc" })).toBe(true);
    expect(isWrappedResponse({ rows: [1, 2, 3] })).toBe(false);
  });
});

describe("MQTTClient clientId", () => {
  it("generates unique dynamic clientId when empty string is passed", () => {
    const client1 = new MQTTClient("tcp://localhost:1883", "");
    const client2 = new MQTTClient("tcp://localhost:1883", "");

    expect(client1["clientId"]).toMatch(/^huozige-web-app-cli-[a-f0-9]{8}$/);
    expect(client2["clientId"]).toMatch(/^huozige-web-app-cli-[a-f0-9]{8}$/);
    expect(client1["clientId"]).not.toBe(client2["clientId"]);
  });

  it("uses provided clientId when non-empty string is passed", () => {
    const client = new MQTTClient("tcp://localhost:1883", "my-custom-client");

    expect(client["clientId"]).toBe("my-custom-client");
  });

  it("uses provided clientId even if it looks like UUID", () => {
    const client = new MQTTClient("tcp://localhost:1883", "abc123");

    expect(client["clientId"]).toBe("abc123");
  });
});
