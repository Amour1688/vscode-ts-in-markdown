import * as TS from 'typescript';
import {
  Location,
  Position,
  Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  toVirtualPath, uriToFsPath, filterEmpty, fsPathToUri, toRealFilePath,
} from '@ts-in-markdown/shared';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position): Location[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(position);
    const fileName = uriToFsPath(uri);
    const referenceEntries = languageService.getReferencesAtPosition(toVirtualPath(fileName), offset);
    if (!referenceEntries) {
      return [];
    }

    return referenceEntries.map((referenceEntry) => {
      const targetUri = fsPathToUri(referenceEntry.fileName);
      const doc = getTextDocument(targetUri);
      if (!doc) {
        return;
      }
      const range: Range = {
        start: doc.positionAt(referenceEntry.textSpan.start),
        end: doc.positionAt(referenceEntry.textSpan.start + referenceEntry.textSpan.length),
      };
      return {
        uri: toRealFilePath(targetUri),
        range,
      };
    }).filter(filterEmpty) ?? [];
  };
}
