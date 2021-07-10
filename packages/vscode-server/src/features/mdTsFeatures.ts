import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import { createLanguageService } from '@ts-in-markdown/vscode-typescript-languageservice';
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
    const doc = service.getVirtualDocumentInfo(uri, position);
    return service.doCompletion(uri, doc.position, context);
  });

  connection.onCompletionResolve((item) => service.doCompletionResolve(item));

  connection.onDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    const doc = service.getVirtualDocumentInfo(uri, position);
    return service.findDefinitions(uri, doc.position);
  });

  connection.onHover((handler) => {
    const { textDocument: { uri }, position } = handler;
    const doc = service.getVirtualDocumentInfo(uri, position);
    return service.doHover(uri, doc.position);
  });

  connection.onDocumentFormatting((handler) => {
    const { textDocument, options } = handler;

    return service.doFormatting(textDocument.uri, options);
  });

  connection.onTypeDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    const doc = service.getVirtualDocumentInfo(uri, position);
    return service.fineTypeDefinition(uri, doc.position);
  });

  connection.onReferences((handler) => {
    const { textDocument: { uri }, position } = handler;
    const doc = service.getVirtualDocumentInfo(uri, position);
    return service.findReferences(uri, doc.position);
  });
}
