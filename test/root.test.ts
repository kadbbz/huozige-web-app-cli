import { describe, expect, it } from "vitest";

import {
  parseJSONBody,
  parseJSONStringMap,
  parseBindingArgs
} from "../src/commands/root";

describe("parseBindingArgs", () => {
  it("accepts canonical binding command names", () => {
    const result = parseBindingArgs(["OASystem", "GetTableDataWithOffset", "post", '{"a":1}']);

    expect(result).toEqual({
      applicationName: "OASystem",
      commandName: "GetTableDataWithOffset",
      method: "POST",
      jsonBody: '{"a":1}'
    });
  });

  it("normalizes combo binding aliases to the MQTT command name", () => {
    const result = parseBindingArgs(["OASystem", "cAnDiDaTeSbInDiNgS", "post", '{"a":1}']);

    expect(result.commandName).toBe("GetComboBindingOptions");
  });

  it("normalizes table binding aliases to the MQTT command name", () => {
    const result = parseBindingArgs(["OASystem", "tablebinding", "post", '{"a":1}']);

    expect(result.commandName).toBe("GetTableDataWithOffset");
  });

  it("normalizes canonical command names without changing protocol casing", () => {
    const result = parseBindingArgs(["OASystem", "getcombobindingoptions", "post", '{"a":1}']);

    expect(result.commandName).toBe("GetComboBindingOptions");
  });

  it("rejects missing applicationName", () => {
    expect(() => parseBindingArgs([])).toThrow("applicationName is required");
  });

  it("rejects missing commandName", () => {
    expect(() => parseBindingArgs(["OASystem"])).toThrow("commandName is required");
  });

  it("rejects missing method", () => {
    expect(() => parseBindingArgs(["OASystem", "CalcBindingDataSource"])).toThrow("method is required");
  });

  it("rejects missing body", () => {
    expect(() => parseBindingArgs(["OASystem", "CalcBindingDataSource", "POST"])).toThrow("body is required");
  });

  it("rejects unsupported binding command", () => {
    expect(() => parseBindingArgs(["OASystem", "UnknownBinding", "POST", '{"a":1}'])).toThrow(
      "unsupported binding commandName: UnknownBinding)"
    );
  });
});

describe("parseJSONBody", () => {
  it("accepts valid json", () => {
    expect(parseJSONBody('{"CommandId":"x","Params":{}}', "body")).toEqual({
      CommandId: "x",
      Params: {}
    });
  });

  it("rejects invalid json", () => {
    expect(() => parseJSONBody('{"CommandId":', "body")).toThrow("invalid JSON param for body");
  });
});

describe("parseJSONStringMap", () => {
  it("accepts object with string values", () => {
    expect(parseJSONStringMap('{"userId":"123"}', "query")).toEqual({ userId: "123" });
  });

  it("rejects non-string values", () => {
    expect(() => parseJSONStringMap('{"userId":123}', "query")).toThrow(
      'invalid JSON param for query: key "userId" must map to string'
    );
  });
});