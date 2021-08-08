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

  for (const folder of folders) {
    ts.sys.watchDirectory!(folder, () => {
      service.update();
    }, true);
  }

  documents.onDidChangeContent(({ document }) => {
    service.onDocumentUpdate(document);

    const openedMarkdownDocs: TextDocument[] = [];
    documents.all().forEach((doc) => {
      if (doc.languageId === 'markdown') {
        openedMarkdownDocs.push(doc);
      }
    });
    for (const doc of openedMarkdownDocs) {
      const diagnostics = service.doValidation(doc.uri);
      connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics,
      });
    }
  });

  connection.onCompletion((handler) => {
    const { textDocument: { uri }, position, context } = handler;
    return service.doCompletion(uri, position, context);
  });

  connection.onCompletionResolve((item) => service.doCompletionResolve(item));

  connection.onDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    return service.findDefinitions(uri, position);
  });

  connection.onHover((handler) => {
    const { textDocument: { uri }, position } = handler;
    return service.doHover(uri, position);
  });

  connection.onDocumentFormatting((handler) => {
    const { textDocument: { uri }, options } = handler;
    return service.doFormatting(uri, options);
  });

  connection.onTypeDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    return service.fineTypeDefinition(uri, position);
  });

  connection.onReferences((handler) => {
    const { textDocument: { uri }, position } = handler;
    return service.findReferences(uri, position);
  });

  connection.onFoldingRanges((handler) => service.doFolding(handler.textDocument.uri));
}
