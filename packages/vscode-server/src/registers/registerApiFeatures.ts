import type { Connection, TextDocumentRegistrationOptions } from 'vscode-languageserver/node'
import { HoverRequest } from 'vscode-languageserver/node'
import { createLanguageService } from '@dali/vscode-typescript-languageservice'

export function register(connect: Connection, ts: typeof import('typescript/lib/tsserverlibrary')) {
  connect.client.register(HoverRequest.type, {
    documentSelector: [
      { scheme: 'file', language: 'markdown' },
  ],
  } as TextDocumentRegistrationOptions)
}
