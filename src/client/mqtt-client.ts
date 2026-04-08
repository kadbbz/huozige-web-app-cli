import { randomUUID } from "node:crypto";
import { connect, type IClientOptions, type MqttClient as NodeMqttClient } from "mqtt";

import type { CommandParameters, Request, Response } from "../protocol/messages";

export class MQTTClient {
  private readonly broker: string;
  private readonly username: string;
  private readonly password: string;
  private readonly clientId: string;
  private client?: NodeMqttClient;
  private requestTopic = "openclaw/req";
  private responseTopic = "openclaw/res";

  public constructor(broker: string, clientId: string, username = "", password = "") {
    this.broker = broker;
    this.clientId = clientId || `huozige-web-app-cli-${randomUUID().slice(0, 8)}`;
    this.username = username;
    this.password = password;
  }

  public setTopics(requestTopic: string, responseTopic: string): void {
    if (requestTopic) {
      this.requestTopic = requestTopic;
    }

    if (responseTopic) {
      this.responseTopic = responseTopic;
    }
  }

  public async connect(): Promise<void> {
    const { brokerUrl, rejectUnauthorized } = normalizeBroker(this.broker);
    const options: IClientOptions = {
      clientId: this.clientId,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 5_000,
      keepalive: 30
    };

    if (rejectUnauthorized === false) {
      options.rejectUnauthorized = false;
    }

    if (this.username) {
      options.username = this.username;
      options.password = this.password;
    }

    this.client = connect(brokerUrl, options);

    await new Promise<void>((resolve, reject) => {
      const client = this.requireClient();

      const handleConnect = (): void => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error): void => {
        cleanup();
        reject(new Error(`failed to connect to MQTT broker: ${error.message}`));
      };

      const cleanup = (): void => {
        client.off("connect", handleConnect);
        client.off("error", handleError);
      };

      client.once("connect", handleConnect);
      client.once("error", handleError);
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.client || !this.client.connected) {
      return;
    }

    const client = this.client;
    await new Promise<void>((resolve) => {
      client.end(false, {}, () => resolve());
    });
  }

  public async sendRequest(
    command: string,
    userName: string,
    sessionId: string,
    agentName: string,
    parameters: CommandParameters,
    timeoutMs: number
  ): Promise<Response> {
    const traceId = randomUUID();
    const request: Request = {
      traceId,
      command,
      userName,
      sessionId,
      agentName,
      parameters,
      timestamp: Math.floor(Date.now() / 1_000)
    };

    let requestPayload: string;
    try {
      requestPayload = JSON.stringify(request);
    } catch (error) {
      throw new Error(`failed to marshal request: ${formatErrorMessage(error)}`);
    }

    const client = this.requireClient();
    const responseTopic = `${this.responseTopic}/${traceId}`;

    let cleanup: (() => void) | undefined;
    const responsePromise = new Promise<Response>((resolve, reject) => {
      let settled = false;

      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup?.();
        action();
      };

      const timer = setTimeout(() => {
        finish(() => reject(new Error(`request timeout after ${timeoutMs}ms`)));
      }, timeoutMs);

      const handleMessage = (topic: string, payload: Buffer): void => {
        if (topic !== responseTopic) {
          return;
        }

        try {
          const response = parseResponsePayload(payload);
          finish(() => resolve(response));
        } catch (error) {
          finish(() => reject(new Error(`failed to unmarshal response: ${formatErrorMessage(error)}`)));
        }
      };

      cleanup = (): void => {
        clearTimeout(timer);
        client.off("message", handleMessage);
        void this.unsubscribe(responseTopic);
      };

      client.on("message", handleMessage);
    });

    try {
      await this.subscribe(responseTopic, 1);
    } catch (error) {
      cleanup?.();
      throw new Error(`failed to subscribe to response topic: ${formatErrorMessage(error)}`);
    }

    try {
      await this.publish(this.requestTopic, requestPayload, 1);
    } catch (error) {
      cleanup?.();
      throw new Error(`failed to publish request: ${formatErrorMessage(error)}`);
    }

    return responsePromise;
  }

  private requireClient(): NodeMqttClient {
    if (!this.client) {
      throw new Error("mqtt client is not connected");
    }

    return this.client;
  }

  private async subscribe(topic: string, qos: 0 | 1 | 2): Promise<void> {
    const client = this.requireClient();
    await new Promise<void>((resolve, reject) => {
      client.subscribe(topic, { qos }, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async unsubscribe(topic: string): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    await new Promise<void>((resolve) => {
      client.unsubscribe(topic, () => resolve());
    });
  }

  private async publish(topic: string, payload: string, qos: 0 | 1 | 2): Promise<void> {
    const client = this.requireClient();
    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos, retain: false }, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

export function parseResponsePayload(payload: Uint8Array | Buffer | string): Response {
  const trimmedPayload = Buffer.from(payload).toString("utf8").trim();
  if (!trimmedPayload) {
    throw new Error("empty payload");
  }

  if (trimmedPayload.startsWith("{")) {
    const probe = JSON.parse(trimmedPayload) as Record<string, unknown>;
    if (isWrappedResponse(probe)) {
      const response = JSON.parse(trimmedPayload) as Partial<Response>;
      return {
        ...response,
        code: typeof response.code === "number" ? response.code : 0
      };
    }
  }

  return {
    code: 0,
    data: JSON.parse(trimmedPayload) as unknown
  };
}

export function isWrappedResponse(probe: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(probe, "code") ||
    Object.prototype.hasOwnProperty.call(probe, "data") ||
    Object.prototype.hasOwnProperty.call(probe, "message") ||
    Object.prototype.hasOwnProperty.call(probe, "traceId") ||
    Object.prototype.hasOwnProperty.call(probe, "correlationId")
  );
}

interface NormalizedBroker {
  brokerUrl: string;
  rejectUnauthorized?: boolean;
}

function normalizeBroker(broker: string): NormalizedBroker {
  const trimmedBroker = broker.trim();

  if (trimmedBroker.startsWith("tcp://")) {
    return { brokerUrl: `mqtt://${trimmedBroker.slice("tcp://".length)}` };
  }

  if (trimmedBroker.startsWith("ssl://")) {
    return { brokerUrl: `mqtts://${trimmedBroker.slice("ssl://".length)}` };
  }

  if (
    trimmedBroker.startsWith("mqtt://") ||
    trimmedBroker.startsWith("mqtts://") ||
    trimmedBroker.startsWith("ws://") ||
    trimmedBroker.startsWith("wss://")
  ) {
    return { brokerUrl: trimmedBroker };
  }

  const hostPort = splitHostPort(trimmedBroker);
  if (!hostPort) {
    return { brokerUrl: trimmedBroker };
  }

  switch (hostPort.port) {
    case "8883":
    case "8884":
      return {
        brokerUrl: `mqtts://${trimmedBroker}`,
        rejectUnauthorized: false
      };
    case "1883":
      return {
        brokerUrl: `mqtt://${trimmedBroker}`
      };
    case "8083":
      return {
        brokerUrl: `ws://${trimmedBroker}/mqtt`
      };
    case "8084":
      return {
        brokerUrl: `wss://${trimmedBroker}/mqtt`,
        rejectUnauthorized: false
      };
    default:
      return {
        brokerUrl: trimmedBroker
      };
  }
}

function splitHostPort(value: string): { host: string; port: string } | undefined {
  if (value.includes("://")) {
    return undefined;
  }

  const ipv6Match = value.match(/^\[(.+)\]:(\d+)$/);
  if (ipv6Match) {
    return {
      host: ipv6Match[1],
      port: ipv6Match[2]
    };
  }

  const firstColonIndex = value.indexOf(":");
  const lastColonIndex = value.lastIndexOf(":");
  if (firstColonIndex <= 0 || firstColonIndex !== lastColonIndex || lastColonIndex === value.length - 1) {
    return undefined;
  }

  return {
    host: value.slice(0, lastColonIndex),
    port: value.slice(lastColonIndex + 1)
  };
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
