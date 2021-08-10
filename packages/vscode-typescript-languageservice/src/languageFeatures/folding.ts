import * as ts from 'typescript';
import {
  FoldingRange,
  FoldingRangeKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@ts-in-markdown/shared';

export function register(
  languageService: ts.LanguageService,
  getTextDocument: (uri: string) => (TextDocument | undefined)[] | undefined,
) {
  return (uri: string): FoldingRange[] => {
    const documents = getTextDocument(uri);
    if (!documents?.length) {
      return [];
    }

    const foldingRanges: FoldingRange[] = [];

    for (const document of documents) {
      if (!document) {
        continue;
      }

      const outliningSpans = languageService.getOutliningSpans(uriToFsPath(document.uri));
      outliningSpans.forEach((outliningSpan) => {
        const start = document.positionAt(outliningSpan.textSpan.start);
        const end = document.positionAt(outliningSpan.textSpan.start + outliningSpan.textSpan.length);
        foldingRanges.push({
          startLine: start.line,
          endLine: end.line,
          startCharacter: start.character,
          endCharacter: end.character,
          kind: getFoldingRangeKind(outliningSpan.kind),
        });
      });
    }
    return foldingRanges;
  };
}

function getFoldingRangeKind(kind: ts.OutliningSpanKind) {
  switch (kind) {
    case 'comment': return FoldingRangeKind.Comment;
    case 'region': return FoldingRangeKind.Region;
    case 'imports': return FoldingRangeKind.Imports;
    case 'code':
    default: return undefined;
  }
}
