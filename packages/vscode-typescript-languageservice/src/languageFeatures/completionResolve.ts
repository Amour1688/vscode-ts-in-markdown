/* eslint-disable no-param-reassign */
import * as TS from 'typescript';
import {
  CompletionItem,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: TS.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (item: CompletionItem): CompletionItem => {
    console.log(languageService, getTextDocument);
    return item;
  };
}
