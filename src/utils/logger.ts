import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static debugMode: boolean = false;

    static configure(name: string, debugMode: boolean = false) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.debugMode = debugMode;
    }

    static setDebugMode(enabled: boolean) {
        this.debugMode = enabled;
    }

    static debug(message: string) {
        if (!this.debugMode) {
            return;
        }
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [DEBUG] ${message}`);
    }

    static info(message: string) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [INFO] ${message}`);
    }

    static error(message: string) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [ERROR] ${message}`);
    }

    static warn(message: string) {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [WARN] ${message}`);
    }

    static show() {
        this.outputChannel.show();
    }

    static dispose() {
        this.outputChannel.dispose();
    }
}
