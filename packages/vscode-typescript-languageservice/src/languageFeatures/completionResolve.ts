import {
  CompletionItem,
} from 'vscode-languageserver/node';

export function register() {
  return (item: CompletionItem): CompletionItem => item; // TODO
}
