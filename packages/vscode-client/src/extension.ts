import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';
import * as path from 'path';
import type { ServerInitializationOptions } from '@dali/shared';

let client: lsp.LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('node_modules', '@dali', 'vscode-server', 'out', 'server.js'),
  );
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions: lsp.ServerOptions = {
    run: { module: serverModule, transport: lsp.TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: lsp.TransportKind.ipc,
      options: debugOptions,
    },
  };

  const serverInitOptions: ServerInitializationOptions = {
    appRoot: vscode.env.appRoot,
  };

  const clientOptions: lsp.LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'markdown' }],
    initializationOptions: serverInitOptions,
  };

  client = new lsp.LanguageClient(
    'Dali Markdown',
    'markdown',
    serverOptions,
    clientOptions,
  );
  client.start();

  return client;
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
