import type { CommandParameters, Response } from "../protocol/messages";
export declare class MQTTClient {
    private readonly broker;
    private readonly username;
    private readonly password;
    private readonly clientId;
    private client?;
    private requestTopic;
    private responseTopic;
    constructor(broker: string, clientId: string, username?: string, password?: string);
    setTopics(requestTopic: string, responseTopic: string): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendRequest(command: string, userName: string, sessionId: string, agentName: string, parameters: CommandParameters, timeoutMs: number): Promise<Response>;
    private requireClient;
    private subscribe;
    private unsubscribe;
    private publish;
}
export declare function parseResponsePayload(payload: Uint8Array | Buffer | string): Response;
export declare function isWrappedResponse(probe: Record<string, unknown>): boolean;
