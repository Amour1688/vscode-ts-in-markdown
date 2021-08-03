import * as ts from 'typescript';
import {
  FoldingRange,
  FoldingRangeKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, toVirtualPath } from '@ts-in-markdown/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string): FoldingRange[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const outliningSpans = languageService.getOutliningSpans(toVirtualPath(uriToFsPath(uri)));

    return outliningSpans.map<FoldingRange>((outliningSpan) => {
      const start = document.positionAt(outliningSpan.textSpan.start);
      const end = document.positionAt(outliningSpan.textSpan.start + outliningSpan.textSpan.length);
      return {
        startLine: start.line,
        endLine: end.line,
        startCharacter: start.character,
        endCharacter: end.character,
        kind: getFoldingRangeKind(outliningSpan.kind),
      };
    });
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
