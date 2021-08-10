import * as ts from 'typescript';
import { LocationLink, Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { fsPathToUri } from '@ts-in-markdown/shared';

export function register(
  languageService: ts.LanguageService,
  getTextDocumentByPosition: (
    uri: string,
    position: Position
  ) => { document?: TextDocument; virtualFsPath: string } | undefined,
  getTextDocument: (uri: string) => (TextDocument | undefined)[] | undefined,
) {
  return (uri: string, position: Position): LocationLink[] => {
    const { document, virtualFsPath } = getTextDocumentByPosition(uri, position) ?? {};
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(position);
    const definitions = languageService.getTypeDefinitionAtPosition(
      virtualFsPath!,
      offset,
    );

    const locationLinks: LocationLink[] = [];
    definitions?.forEach((definition) => {
      const targetUri = fsPathToUri(definition.fileName);
      const docs = getTextDocument(targetUri);
      docs?.forEach((doc) => {
        if (!doc) {
          return;
        }
        const targetSelectionRange: Range = {
          start: doc.positionAt(definition.textSpan.start),
          end: doc.positionAt(
            definition.textSpan.start + definition.textSpan.length,
          ),
        };
        const targetRange: Range = definition.contextSpan
          ? {
            start: doc.positionAt(definition.contextSpan.start),
            end: doc.positionAt(
              definition.contextSpan.start + definition.contextSpan.length,
            ),
          }
          : targetSelectionRange;

        const originSelectionRange = definition.originalTextSpan
          ? {
            start: doc.positionAt(definition.originalTextSpan.start),
            end: doc.positionAt(
              definition.originalTextSpan.start
                  + definition.originalTextSpan.length,
            ),
          }
          : undefined;
        locationLinks.push({
          targetUri,
          targetRange,
          originSelectionRange,
          targetSelectionRange,
        });
      });
    });

    return locationLinks;
  };
}
