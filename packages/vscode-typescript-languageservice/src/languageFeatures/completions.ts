import * as TS from 'typescript';
import {
  CompletionContext,
  CompletionItem,
  CompletionTriggerKind,
  Position,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, toVirtualPath } from '@dali/shared';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position, context?: CompletionContext): CompletionItem[] | undefined => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return;
    }

    if (context?.triggerKind !== CompletionTriggerKind.TriggerCharacter) {
      // console.log(23);
    }

    const offset = document.offsetAt(position);
    const fileName = uriToFsPath(uri);
    const body = languageService.getCompletionsAtPosition(toVirtualPath(fileName), offset, {});

    if (!body) {
      return [];
    }
  };
}
