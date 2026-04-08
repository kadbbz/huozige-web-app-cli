export type CommandParameters = Record<string, unknown>;
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
export declare function newSuccessResponse(data: unknown): Response;
export declare function newErrorResponse(code: number, message: string): Response;
