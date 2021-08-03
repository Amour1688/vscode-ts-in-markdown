import { uriToFsPath, toVirtualPath } from '@ts-in-markdown/shared';
import {
  MarkupContent,
  MarkupKind,
} from 'vscode-languageserver/node';
import type {
  Hover,
  Position,
} from 'vscode-languageserver/node';
import type * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { markdownDocumentation } from '../utils/previewer';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, { displayPartsToString }: typeof import('typescript')) {
  return (uri: string, position: Position): Hover | undefined => {
    const document = getTextDocument(toVirtualPath(uri));
    if (!document) {
      return;
    }

    const offset = document.offsetAt(position);
    const info = languageService.getQuickInfoAtPosition(toVirtualPath(uriToFsPath(uri)), offset);
    if (!info) {
      return;
    }

    const parts: string[] = [];
    const displayString = displayPartsToString(info.displayParts);
    const documentation = markdownDocumentation(info.documentation, info.tags);

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
