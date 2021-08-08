import { URI } from 'vscode-uri';
import {
  MarkupContent,
  MarkupKind,
  Hover,
  Position,
} from 'vscode-languageserver/node';

import type * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { markdownDocumentation } from '../utils/previewer';

export function register(
  languageService: ts.LanguageService,
  getTextDocument: (
    uri: string,
    position: Position
  ) => { document?: TextDocument; virtualFsPath: string } | undefined,
  { displayPartsToString }: typeof import('typescript'),
) {
  return (uri: string, position: Position): Hover | undefined => {
    const { document, virtualFsPath } = getTextDocument(uri, position) ?? {};
    if (!document) {
      return;
    }

    const offset = document.offsetAt(position);
    const info = languageService.getQuickInfoAtPosition(virtualFsPath!, offset);
    if (!info) {
      return;
    }

    const parts: string[] = [];
    const displayString = displayPartsToString(info.displayParts);
    const documentation = markdownDocumentation(info.documentation, info.tags, {
      toResource: (fsPath: string) => URI.file(fsPath),
    });

    if (displayString) {
      parts.push(['```typescript', displayString, '```'].join('\n'));
    }
    if (documentation) {
      parts.push(documentation);
    }

    const markdown: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: parts.join('\n\n'),
    };

    return {
      contents: markdown,
    };
  };
}
