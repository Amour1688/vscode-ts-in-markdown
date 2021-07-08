import { uriToFsPath, toVirtualPath } from '@ts-in-markdown/shared';
import {
  MarkupContent,
  MarkupKind,
} from 'vscode-languageserver/node';
import type {
  Hover,
  Position,
} from 'vscode-languageserver/node';
import * as TS from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { markdownDocumentation } from '../utils/previewer';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
  return (uri: string, position: Position): Hover | undefined => {
    const document = getTextDocument(toVirtualPath(uri));
    if (!document) {
      return;
    }

    const offset = document.offsetAt(position);
    const fileName = uriToFsPath(uri);
    const info = languageService.getQuickInfoAtPosition(toVirtualPath(fileName), offset);
    if (!info) {
      return;
    }

    const parts: string[] = [];
    const displayString = ts.displayPartsToString(info.displayParts);
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
