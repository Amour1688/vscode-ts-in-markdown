import type {
  Connection, TextDocuments, FoldingRange, TextEdit, Diagnostic,
} from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { createLanguageService } from 'vscode-typescript-languageservice';
import { createTypeScriptService } from '../services/typescript';

export function register(
  connection: Connection,
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[],
) {
  const {
    update, onDocumentUpdate, languageService, host, getVirtualFile, getOriginUri,
  } = createTypeScriptService(ts, documents, folders);
  const service = createLanguageService(ts, host, languageService);

  for (const folder of folders) {
    ts.sys.watchDirectory!(folder, () => {
      update();
    }, true);
  }

  documents.onDidChangeContent(({ document }) => {
    onDocumentUpdate(document);

    const openedMarkdownDocs: TextDocument[] = [];
    documents.all().forEach((doc) => {
      if (doc.languageId === 'markdown') {
        openedMarkdownDocs.push(doc);
      }
    });

    for (const doc of openedMarkdownDocs) {
      const virtualFile = getVirtualFile(doc.uri);
      const diagnostics: Diagnostic[] = [];
      if (virtualFile) {
        for (const { uri, lang } of virtualFile) {
          if (lang === 'tsx' || lang === 'ts') {
            diagnostics.push(...service.doValidation(uri, {
              semantic: true,
              syntactic: true,
              suggestion: true,
              declaration: true,
            }));
          }
        }
      }
      connection.sendDiagnostics({
        uri: doc.uri,
        diagnostics,
      });
    }
  });

  connection.onCompletion((handler) => {
    const { textDocument, position, context } = handler;
    const virtualFile = getVirtualFile(textDocument.uri, position);
    if (virtualFile) {
      return service.doComplete(virtualFile.uri, position, {
        ...context,
        triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
      });
    }
  });

  connection.onCompletionResolve((item) => service.doCompletionResolve(item));

  connection.onPrepareRename((handler) => {
    const { textDocument: { uri }, position } = handler;
    const virtualFile = getVirtualFile(uri, position);
    if (virtualFile) {
      return service.prepareRename(virtualFile.uri, position);
    }
  });

  connection.onRenameRequest(async (handler) => {
    const { textDocument: { uri }, position, newName } = handler;
    const virtualFile = getVirtualFile(uri, position);
    if (virtualFile) {
      const tsResult = await service.doRename(virtualFile.uri, position, newName);
      if (tsResult) {
        const { changes = {} } = tsResult;
        const mdChanges: { [uri: string]: TextEdit[] } = {};
        Object.keys(changes).forEach((changeUri) => {
          mdChanges[getOriginUri(changeUri)] = changes[changeUri];
        });
        return { ...tsResult, changes: mdChanges };
      }
    }
  });

  connection.onHover((handler) => {
    const { textDocument: { uri }, position } = handler;
    const virtualFile = getVirtualFile(uri, position);
    if (virtualFile) {
      return service.doHover(virtualFile.uri, position);
    }
  });

  connection.onDocumentFormatting(async (handler) => {
    const { textDocument: { uri }, options } = handler;
    const textEdits: TextEdit[] = [];
    const virtualFile = getVirtualFile(uri);
    if (virtualFile) {
      for (const virtual of virtualFile) {
        const edits = await service.doFormatting(virtual.uri, options);
        textEdits.push(...edits);
      }
      return service.doFormatting(uri, options);
    }
    return textEdits;
  });

  connection.onTypeDefinition((handler) => {
    const { textDocument, position } = handler;
    const virtualFile = getVirtualFile(textDocument.uri, position);

    if (virtualFile) {
      const tsResult = service.findTypeDefinition(virtualFile.uri, position);
      return tsResult.map((tsLink) => ({
        ...tsLink,
        targetUri: getOriginUri(tsLink.targetUri),
      }));
    }
  });

  connection.onDefinition((handler) => {
    const { textDocument: { uri }, position } = handler;
    const virtualFile = getVirtualFile(uri, position);
    if (virtualFile) {
      const tsResult = service.findDefinition(virtualFile.uri, position);
      return tsResult.map((tsLink) => ({
        ...tsLink,
        targetUri: getOriginUri(tsLink.targetUri),
      }));
    }
  });

  connection.onReferences((handler) => {
    const { textDocument: { uri }, position } = handler;
    const virtualFile = getVirtualFile(uri, position);
    if (virtualFile) {
      const tsResult = service.findReferences(virtualFile.uri, position);
      return tsResult.map((tsLoc) => ({
        ...tsLoc,
        uri: getOriginUri(tsLoc.uri),
      }));
    }
  });

  connection.onFoldingRanges((handler) => {
    const virtualFiles = getVirtualFile(handler.textDocument.uri);
    const foldingRanges: FoldingRange[] = [];
    if (virtualFiles) {
      for (const { uri } of virtualFiles) {
        foldingRanges.push(...service.getFoldingRanges(uri));
      }
    }
    return foldingRanges;
  });
}
