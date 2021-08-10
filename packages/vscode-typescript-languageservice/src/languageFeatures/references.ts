import * as ts from 'typescript';
import { Location, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, fsPathToUri } from '@ts-in-markdown/shared';

export function register(
  languageService: ts.LanguageService,
  getTextDocument: (uri: string) => (TextDocument | undefined)[] | undefined,
  virtualMap: Map<
  string,
  {
    originFileName: string;
    blockIndex: number;
    version: number;
  }
  >,
) {
  return (uri: string, position: Position): Location[] => {
    const documents = getTextDocument(uri);
    if (!documents) {
      return [];
    }

    const locations: Location[] = [];

    for (const document of documents) {
      if (!document) {
        continue;
      }

      const offset = document.offsetAt(position);
      const referenceEntries = languageService.getReferencesAtPosition(
        uriToFsPath(document.uri),
        offset,
      );

      referenceEntries?.forEach((referenceEntry) => {
        const targetUri = fsPathToUri(referenceEntry.fileName);
        const docs = getTextDocument(targetUri);
        docs?.forEach((doc) => {
          if (!doc) {
            return;
          }
          const range: Range = {
            start: doc.positionAt(referenceEntry.textSpan.start),
            end: doc.positionAt(
              referenceEntry.textSpan.start + referenceEntry.textSpan.length,
            ),
          };

          locations.push({
            uri:
              virtualMap.get(uriToFsPath(targetUri))?.originFileName
              ?? targetUri,
            range,
          });
        });
      });
    }
    return locations;
  };
}
