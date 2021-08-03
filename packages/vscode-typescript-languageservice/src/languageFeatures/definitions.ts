import * as ts from 'typescript';
import {
  Position,
  Range,
  LocationLink,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, fsPathToUri, toVirtualPath } from '@ts-in-markdown/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position): LocationLink[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(position);
    const body = languageService.getDefinitionAndBoundSpan(toVirtualPath(uriToFsPath(uri)), offset);

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
      const doc = getTextDocument(locationUri);
      if (doc && locationUri !== tsxUri) {
        const targetSelectionRange: Range = {
          start: doc.positionAt(location.textSpan.start),
          end: doc.positionAt(location.textSpan.start + location.textSpan.length),
        };
        const targetRange: Range = location.contextSpan ? {
          start: doc.positionAt(location.contextSpan.start),
          end: doc.positionAt(location.contextSpan.start + location.contextSpan.length),
        } : targetSelectionRange;

        locationLinks.push({
          originSelectionRange,
          targetUri: locationUri,
          targetRange,
          targetSelectionRange,
        });
      }
    }

    return locationLinks;
  };
}
