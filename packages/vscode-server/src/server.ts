import {
  createConnection, ProposedFeatures, TextDocumentSyncKind, TextDocuments,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { ServerInitializationOptions } from '@dali/shared';
import { loadTypeScript, uriToFsPath } from '@dali/shared';
import type { InitializeResult, InitializeParams } from 'vscode-languageserver/node';
import { register as registerApiFeatures } from './registers/registerApiFeatures';
import { register as registerMdTsFeatures } from './features/mdTsFeatures';

let options: ServerInitializationOptions;
let folders: string[] = [];

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
connection.listen();
documents.listen(connection);

function onInitialize(params: InitializeParams) {
  options = params.initializationOptions;
  folders = params.workspaceFolders
    ? params.workspaceFolders
      .map((folder) => folder.uri)
      .filter((uri) => uri.startsWith('file:/'))
      .map((uri) => uriToFsPath(uri))
    : [];
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
      },
      definitionProvider: true,
      hoverProvider: true,
    },
  };

  return result;
}

async function onInitialized() {
  registerApiFeatures(connection, loadTypeScript(options.appRoot));

  registerMdTsFeatures(connection, loadTypeScript(options.appRoot), documents, folders);
}
