export type CommandParameters = Record<string, unknown>;

// 这里保留原始请求字段名，避免和既有 MQTT 消费端出现协议偏差。
export interface Request {
  traceId: string;
  command: string;
  userName?: string;
  sessionId?: string;
  agentName?: string;
  parameters?: CommandParameters;
  timestamp: number;
}

export interface ProxyRequest {
  method: string;
  path: string;
  queryParams?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface Response {
  traceId?: string;
  correlationId?: string;
  code: number;
  message?: string;
  data?: unknown;
}

export function newSuccessResponse(data: unknown): Response {
  return {
    code: 0,
    data
  };
}

export function newErrorResponse(code: number, message: string): Response {
  return {
    code,
    message
  };
}
