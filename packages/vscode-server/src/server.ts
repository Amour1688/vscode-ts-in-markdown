import { createConnection, ProposedFeatures, TextDocumentSyncKind } from 'vscode-languageserver/node';
import type { ServerInitializationOptions } from '@dali/shared'
import { loadTypeScript } from '@dali/shared'
import type { InitializeResult, InitializeParams } from 'vscode-languageserver/node';
import { register as registerApiFeatures } from './registers/registerApiFeatures'
import { register as registerMdTsFeatures } from './features/mdTsFeatures'

let options: ServerInitializationOptions;

const connection = createConnection(ProposedFeatures.all);

connection.onInitialize(onInitialize)
connection.onInitialized(onInitialized)
connection.listen()

function onInitialize(params: InitializeParams) {
  options = params.initializationOptions
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
      hoverProvider: true
    }
  }

  return result;
}

async function onInitialized() {

  registerApiFeatures(connection, loadTypeScript(options.appRoot))

  registerMdTsFeatures(connection, loadTypeScript(options.appRoot))
}
