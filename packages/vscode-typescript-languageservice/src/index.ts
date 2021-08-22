import { Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as hover from './languageFeatures/hover';
import * as definitions from './languageFeatures/definitions';
import * as completion from './languageFeatures/completion';
import * as completionResolve from './languageFeatures/completionResolve';
import * as typeDefinition from './languageFeatures/typeDefinition';
import * as diagnostics from './languageFeatures/diagnostics';
import * as formatting from './languageFeatures/formatting';
import * as folding from './languageFeatures/folding';
import * as references from './languageFeatures/references';

export function createLanguageService(
  ts: typeof import('typescript/lib/tsserverlibrary'),
  languageService: ts.LanguageService,
  getTextDocument: (
    uri: string,
    position: Position
  ) =>
  | {
    document: TextDocument | undefined;
    virtualFsPath: string;
  }
  | undefined,
  getTextDocuments: (uri: string) => (TextDocument | undefined)[] | undefined,
  virtualMap: Map<
  string,
  {
    originFileName: string;
    blockIndex: number;
    version: number;
  }
  >,
) {
  return {
    doHover: hover.register(languageService, getTextDocument, ts),
    doCompletion: completion.register(languageService, getTextDocument),
    doValidation: diagnostics.register(languageService, getTextDocuments, ts),
    doCompletionResolve: completionResolve.register(),
    doFormatting: formatting.register(languageService, getTextDocuments),
    doFolding: folding.register(languageService, getTextDocuments),
    fineTypeDefinition: typeDefinition.register(
      languageService,
      getTextDocument,
      getTextDocuments,
    ),
    findDefinitions: definitions.register(
      languageService,
      getTextDocument,
      getTextDocuments,
    ),
    findReferences: references.register(
      languageService,
      getTextDocuments,
      virtualMap,
    ),
  };
}
