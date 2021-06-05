import * as ts from 'typescript'
import { uriToFsPath } from '@dali/shared'
import {
	MarkupContent,
	MarkupKind,
} from 'vscode-languageserver/node';
import type {
	Hover,
	Position,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
  return (uri: string, position: Position): Hover | undefined => {
    const document = getTextDocument(uri)
    const fileName = uriToFsPath(uri)
    const info = languageService.getQuickInfoAtPosition(fileName + '__TS.tsx', 10)
    if (!info) {
      return
    }

    const parts: string[] = []
		const displayString = ts.displayPartsToString(info.displayParts)

    if (displayString) {
			parts.push(['```typescript', displayString, '```'].join('\n'));
		}

    const markdown: MarkupContent = {
			kind: MarkupKind.Markdown,
			value: parts.join('\n\n'),
		}

    return {
      contents: markdown,
    }
  }
}
