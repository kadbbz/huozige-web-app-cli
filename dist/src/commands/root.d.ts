import { type Config } from "../config/config";
import type { CommandParameters } from "../protocol/messages";
export declare const allowedBindingEndpoints: readonly ["TableBinding", "GetTableDataWithOffset", "CandidatesBinding", "GetComboBindingOptions"];
export interface CliIO {
    stdout(message: string): void;
    stderr(message: string): void;
}
export declare function runCli(argv: string[], io?: CliIO): Promise<number>;
export declare function executeServerCommand(config: Config, args: string[], userName: string, sessionId: string, agentName: string, io?: CliIO): Promise<void>;
export declare function executeBindingCommand(config: Config, args: string[], userName: string, sessionId: string, agentName: string, io?: CliIO): Promise<void>;
export declare function parseBindingArgs(args: string[]): {
    applicationName: string;
    commandName: string;
    method: string;
    jsonBody: string;
};
export declare function parseJSONBody(raw: string, targetName: string): unknown;
export declare function parseJSONStringMap(raw: string, targetName: string): Record<string, string>;
export declare function sendCommand(config: Config, command: string, userName: string, sessionId: string, agentName: string, parameters: CommandParameters, io?: CliIO): Promise<void>;
export declare function executeStatus(config: Config, configPath: string, io?: CliIO): void;
