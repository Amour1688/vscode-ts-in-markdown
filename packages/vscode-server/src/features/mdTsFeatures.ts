import type { Connection, TextDocuments } from 'vscode-languageserver/node';
import { createLanguageService } from '@dali/vscode-typescript-languageservice'

export function register(connection: Connection, ts: typeof import('typescript/lib/tsserverlibrary')) {
  const service = createLanguageService(ts)

  connection.onHover(handler => {
    return {
      contents: {
        kind: 'markdown',
        value: handler.position.line.toString()
      }
    }
  })
}
