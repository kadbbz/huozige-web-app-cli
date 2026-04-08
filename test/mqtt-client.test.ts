import { describe, expect, it } from "vitest";

import { isWrappedResponse, parseResponsePayload } from "../src/client/mqtt-client";

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
