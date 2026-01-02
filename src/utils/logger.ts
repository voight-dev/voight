import * as vscode from 'vscode';

// Declared by esbuild at compile time
declare const __PRODUCTION__: boolean;

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static debugMode: boolean = false;
    private static isProduction: boolean = typeof __PRODUCTION__ !== 'undefined' ? __PRODUCTION__ : false;

    static configure(name: string, debugMode: boolean = false) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        // In production, always disable debug mode regardless of setting
        this.debugMode = this.isProduction ? false : debugMode;
    }

    static setDebugMode(enabled: boolean) {
        // In production, debug mode cannot be enabled
        this.debugMode = this.isProduction ? false : enabled;
    }

    static debug(message: string) {
        // Early exit in production - this will be tree-shaken in prod builds
        if (this.isProduction || !this.debugMode) {
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
