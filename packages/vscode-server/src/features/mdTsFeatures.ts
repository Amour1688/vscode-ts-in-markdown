import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import { createLanguageService } from '@dali/vscode-typescript-languageservice';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(
  connection: Connection,
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[],
) {
  const service = createLanguageService(ts, documents, folders);

  documents.onDidChangeContent((e) => {
    service.onDocumentUpdate(e.document);
  });

  connection.onCompletion((handler) => {
    const { textDocument: { uri }, position, context } = handler;
    const documentInfo = service.getVirtualDocumentInfo(uri, position);
    return service.doCompletion(uri, documentInfo.position, context);
  });

  connection.onCompletionResolve((item) => service.doCompletionResolve(item));

  connection.onDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    const documentInfo = service.getVirtualDocumentInfo(uri, position);
    return service.findDefinitions(uri, documentInfo.position);
  });

  connection.onHover((handler) => {
    const { textDocument: { uri }, position } = handler;
    const documentInfo = service.getVirtualDocumentInfo(uri, position);
    return service.doHover(uri, documentInfo.position);
  });
}
