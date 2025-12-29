import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export function healthCheck() {
    Logger.info('=== Voight Health Check ===');
    Logger.info('Extension is running');
    Logger.info('Status: OK');
    Logger.info('===========================');
    Logger.show();

    vscode.window.showInformationMessage('Voight: Health check passed!');
}
