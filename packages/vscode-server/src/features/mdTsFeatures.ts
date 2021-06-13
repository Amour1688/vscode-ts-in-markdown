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

  connection.onDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    const textDocumentPosition = service.getDocumentPosition(uri, position);
    return service.fineDefinitions(uri, textDocumentPosition.position);
  });

  connection.onHover((handler) => {
    const { textDocument: { uri }, position } = handler;
    const textDocumentPosition = service.getDocumentPosition(uri, position);
    return service.doHover(uri, textDocumentPosition.position);
  });
}
