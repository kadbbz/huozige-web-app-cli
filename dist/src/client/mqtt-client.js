"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTTClient = void 0;
exports.parseResponsePayload = parseResponsePayload;
exports.isWrappedResponse = isWrappedResponse;
const node_crypto_1 = require("node:crypto");
const mqtt_1 = require("mqtt");
class MQTTClient {
    broker;
    username;
    password;
    clientId;
    client;
    requestTopic = "openclaw/req";
    responseTopic = "openclaw/res";
    constructor(broker, clientId, username = "", password = "") {
        this.broker = broker;
        this.clientId = clientId || `huozige-web-app-cli-${(0, node_crypto_1.randomUUID)().slice(0, 8)}`;
        this.username = username;
        this.password = password;
    }
    setTopics(requestTopic, responseTopic) {
        if (requestTopic) {
            this.requestTopic = requestTopic;
        }
        if (responseTopic) {
            this.responseTopic = responseTopic;
        }
    }
    async connect() {
        const { brokerUrl, rejectUnauthorized } = normalizeBroker(this.broker);
        const options = {
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
        this.client = (0, mqtt_1.connect)(brokerUrl, options);
        await new Promise((resolve, reject) => {
            const client = this.requireClient();
            const handleConnect = () => {
                cleanup();
                resolve();
            };
            const handleError = (error) => {
                cleanup();
                reject(new Error(`failed to connect to MQTT broker: ${error.message}`));
            };
            const cleanup = () => {
                client.off("connect", handleConnect);
                client.off("error", handleError);
            };
            client.once("connect", handleConnect);
            client.once("error", handleError);
        });
    }
    async disconnect() {
        if (!this.client || !this.client.connected) {
            return;
        }
        const client = this.client;
        await new Promise((resolve) => {
            client.end(false, {}, () => resolve());
        });
    }
    async sendRequest(command, userName, sessionId, agentName, parameters, timeoutMs) {
        const traceId = (0, node_crypto_1.randomUUID)();
        const request = {
            traceId,
            command,
            userName,
            sessionId,
            agentName,
            parameters,
            timestamp: Math.floor(Date.now() / 1_000)
        };
        let requestPayload;
        try {
            requestPayload = JSON.stringify(request);
        }
        catch (error) {
            throw new Error(`failed to marshal request: ${formatErrorMessage(error)}`);
        }
        const client = this.requireClient();
        const responseTopic = `${this.responseTopic}/${traceId}`;
        let cleanup;
        const responsePromise = new Promise((resolve, reject) => {
            let settled = false;
            const finish = (action) => {
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
            const handleMessage = (topic, payload) => {
                if (topic !== responseTopic) {
                    return;
                }
                try {
                    const response = parseResponsePayload(payload);
                    finish(() => resolve(response));
                }
                catch (error) {
                    finish(() => reject(new Error(`failed to unmarshal response: ${formatErrorMessage(error)}`)));
                }
            };
            cleanup = () => {
                clearTimeout(timer);
                client.off("message", handleMessage);
                void this.unsubscribe(responseTopic);
            };
            client.on("message", handleMessage);
        });
        try {
            await this.subscribe(responseTopic, 1);
        }
        catch (error) {
            cleanup?.();
            throw new Error(`failed to subscribe to response topic: ${formatErrorMessage(error)}`);
        }
        try {
            await this.publish(this.requestTopic, requestPayload, 1);
        }
        catch (error) {
            cleanup?.();
            throw new Error(`failed to publish request: ${formatErrorMessage(error)}`);
        }
        return responsePromise;
    }
    requireClient() {
        if (!this.client) {
            throw new Error("mqtt client is not connected");
        }
        return this.client;
    }
    async subscribe(topic, qos) {
        const client = this.requireClient();
        await new Promise((resolve, reject) => {
            client.subscribe(topic, { qos }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
    async unsubscribe(topic) {
        const client = this.client;
        if (!client) {
            return;
        }
        await new Promise((resolve) => {
            client.unsubscribe(topic, () => resolve());
        });
    }
    async publish(topic, payload, qos) {
        const client = this.requireClient();
        await new Promise((resolve, reject) => {
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
exports.MQTTClient = MQTTClient;
function parseResponsePayload(payload) {
    const trimmedPayload = Buffer.from(payload).toString("utf8").trim();
    if (!trimmedPayload) {
        throw new Error("empty payload");
    }
    if (trimmedPayload.startsWith("{")) {
        const probe = JSON.parse(trimmedPayload);
        if (isWrappedResponse(probe)) {
            const response = JSON.parse(trimmedPayload);
            return {
                ...response,
                code: typeof response.code === "number" ? response.code : 0
            };
        }
    }
    return {
        code: 0,
        data: JSON.parse(trimmedPayload)
    };
}
function isWrappedResponse(probe) {
    return (Object.prototype.hasOwnProperty.call(probe, "code") ||
        Object.prototype.hasOwnProperty.call(probe, "data") ||
        Object.prototype.hasOwnProperty.call(probe, "message") ||
        Object.prototype.hasOwnProperty.call(probe, "traceId") ||
        Object.prototype.hasOwnProperty.call(probe, "correlationId"));
}
function normalizeBroker(broker) {
    const trimmedBroker = broker.trim();
    if (trimmedBroker.startsWith("tcp://")) {
        return { brokerUrl: `mqtt://${trimmedBroker.slice("tcp://".length)}` };
    }
    if (trimmedBroker.startsWith("ssl://")) {
        return { brokerUrl: `mqtts://${trimmedBroker.slice("ssl://".length)}` };
    }
    if (trimmedBroker.startsWith("mqtt://") ||
        trimmedBroker.startsWith("mqtts://") ||
        trimmedBroker.startsWith("ws://") ||
        trimmedBroker.startsWith("wss://")) {
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
function splitHostPort(value) {
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
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
