import * as ts from 'typescript';
import {
  FormattingOptions,
  TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, toVirtualPath } from '@ts-in-markdown/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, options: FormattingOptions): TextEdit[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const tsOptions: ts.FormatCodeSettings = {
      ...options,
    };

    const edits = languageService.getFormattingEditsForDocument(uriToFsPath(uri), tsOptions);
    const result: TextEdit[] = [];

    for (const edit of edits) {
      result.push({
        range: {
          start: document.positionAt(edit.span.start),
          end: document.positionAt(edit.span.start + edit.span.length),
        },
        newText: edit.newText,
      });
    }

    return result;
  };
}
