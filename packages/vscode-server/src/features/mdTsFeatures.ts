import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import { createLanguageService } from '@dali/vscode-typescript-languageservice'
import type { TextDocument } from 'vscode-languageserver-textdocument';


export function register(
  connection: Connection,
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[]
) {
  const service = createLanguageService(ts, documents, folders)

  connection.onHover(handler => {
    return service.doHover(handler.textDocument.uri, handler.position)
  })
}
