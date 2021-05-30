import * as ts from 'typescript'
import {
	MarkupContent,
	MarkupKind,
	Range,
} from 'vscode-languageserver/node';
import type {
	Hover,
	Position,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
  return (uri: string, position: Position): Hover | undefined => {
    const document = getTextDocument(uri)
    return {
      contents: '123424'
    }
  }
}
