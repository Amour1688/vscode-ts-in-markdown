import * as TS from 'typescript';
import {
  LocationLink,
  Position,
  Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  uriToFsPath, toVirtualPath, fsPathToUri, filterEmpty,
} from '@ts-in-markdown/shared';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position): LocationLink[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(position);
    const definitions = languageService.getTypeDefinitionAtPosition(toVirtualPath(uriToFsPath(uri)), offset);

    const locationLinks = definitions?.map((definition) => {
      const targetUri = fsPathToUri(definition.fileName);
      const doc = getTextDocument(targetUri);
      if (doc) {
        const targetSelectionRange: Range = {
          start: doc.positionAt(definition.textSpan.start),
          end: doc.positionAt(definition.textSpan.start + definition.textSpan.length),
        };
        const targetRange: Range = definition.contextSpan ? {
          start: doc.positionAt(definition.contextSpan.start),
          end: doc.positionAt(definition.contextSpan.start + definition.contextSpan.length),
        } : targetSelectionRange;

        const originSelectionRange = definition.originalTextSpan ? {
          start: doc.positionAt(definition.originalTextSpan.start),
          end: doc.positionAt(definition.originalTextSpan.start + definition.originalTextSpan.length),
        } : undefined;
        return {
          targetUri,
          targetRange,
          originSelectionRange,
        } as LocationLink;
      }
      return undefined;
    }).filter(filterEmpty);

    return locationLinks ?? [];
  };
}
