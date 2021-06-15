import * as TS from 'typescript';
import {
  Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@dali/shared';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position) => {
    const tsxUri = `${uri}.__TS.tsx`;
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(position);
    const fileName = uriToFsPath(uri);
    const body = languageService.getCompletionsAtPosition(fileName, offset, {});

    if (!body) {
      return [];
    }
  };
}
