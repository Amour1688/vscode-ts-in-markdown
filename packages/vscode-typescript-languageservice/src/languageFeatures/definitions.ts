import { Position, Range, LocationLink } from 'vscode-languageserver/node';
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
    const body = languageService.getDefinitionAndBoundSpan(
      virtualFsPath!,
      offset,
    );

    if (!body || !body.definitions) {
      return [];
    }

    const locationLinks: LocationLink[] = [];
    const originSelectionRange: Range = {
      start: document.positionAt(body.textSpan.start),
      end: document.positionAt(body.textSpan.start + body.textSpan.length),
    };
    for (const location of body.definitions) {
      const locationUri = fsPathToUri(location.fileName);
      const docs = getTextDocument(locationUri);

      docs?.forEach((doc) => {
        if (!doc) {
          return;
        }

        // if (locationUri === doc.uri) {
        //   return;
        // }
        const targetSelectionRange: Range = {
          start: doc.positionAt(location.textSpan.start),
          end: doc.positionAt(
            location.textSpan.start + location.textSpan.length,
          ),
        };
        const targetRange: Range = location.contextSpan
          ? {
            start: doc.positionAt(location.contextSpan.start),
            end: doc.positionAt(
              location.contextSpan.start + location.contextSpan.length,
            ),
          }
          : targetSelectionRange;

        locationLinks.push({
          originSelectionRange,
          targetUri: locationUri,
          targetRange,
          targetSelectionRange,
        });
      });
    }

    return locationLinks;
  };
}
