/* eslint-disable no-continue */
import {
  Diagnostic,
  DiagnosticTag,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import type * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { toVirtualPath, uriToFsPath } from '@ts-in-markdown/shared';

export function register(
  languageService: ts.LanguageService,
  getTextDocument: (uri: string) => TextDocument | undefined,
  { DiagnosticCategory }: typeof import('typescript/lib/tsserverlibrary'),
) {
  return (uri: string): Diagnostic[] => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return [];
    }

    const program = languageService.getProgram();
    const fileName = toVirtualPath(uriToFsPath(uri));
    const sourceFile = program?.getSourceFile(fileName);

    if (!program || !sourceFile) {
      return [];
    }

    let errors: ts.Diagnostic[] = [];

    try {
      errors = [
        ...program.getSemanticDiagnostics(sourceFile),
        ...program.getSyntacticDiagnostics(sourceFile),
        ...languageService.getSuggestionDiagnostics(fileName),
      ];
    } catch (e) {
      // ignore
    }

    const diagnostics: Diagnostic[] = [];

    for (const error of errors) {
      if (error.start === undefined || error.length === undefined) {
        continue;
      }

      const diagnostic: Diagnostic = {
        range: {
          start: document.positionAt(error.start),
          end: document.positionAt(error.start + error.length),
        },
        severity: convertErrorType(error.category),
        source: 'ts',
        code: error.code,
        message: typeof error.messageText === 'string' ? error.messageText : error.messageText.messageText,
      };

      if (error.reportsDeprecated) {
        diagnostic.tags = [DiagnosticTag.Deprecated];
      }

      if (error.reportsUnnecessary) {
        if (diagnostic.tags === undefined) {
          diagnostic.tags = [];
        }
        diagnostic.tags.push(DiagnosticTag.Unnecessary);
      }

      diagnostics.push(diagnostic);
    }

    return diagnostics;
  };

  function convertErrorType(category: ts.DiagnosticCategory) {
    switch (category) {
      case DiagnosticCategory.Warning: return DiagnosticSeverity.Warning;
      case DiagnosticCategory.Error: return DiagnosticSeverity.Error;
      case DiagnosticCategory.Suggestion: return DiagnosticSeverity.Hint;
      case DiagnosticCategory.Message: return DiagnosticSeverity.Information;
    }
  }
}