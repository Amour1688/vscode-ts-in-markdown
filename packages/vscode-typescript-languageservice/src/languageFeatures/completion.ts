/* eslint-disable no-param-reassign */
import type * as ts from 'typescript';
import {
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  Position,
  TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath, toVirtualPath, locationMap } from '@ts-in-markdown/shared';
import { parseKindModifier } from '../utils/modifiers';
import * as PConst from '../protocol.const';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
  return (uri: string, position: Position, context?: CompletionContext): CompletionItem[] | undefined => {
    const tsxUri = toVirtualPath(uri);
    const document = getTextDocument(tsxUri);
    if (!document) {
      return;
    }

    const locations = locationMap.get(uriToFsPath(tsxUri));

    // should skip position outside the block
    if (
      locations?.some((location) => location.start
        && location.end
        && (location.start.line > position.line || location.end.line < position.line))
    ) {
      return;
    }

    const line = document.getText({
      start: position,
      end: {
        line: position.line + 1,
        character: 0,
      },
    });
    const pre = line.slice(0, position.character);

    if (context && !shouldTrigger(pre, context)) {
      return;
    }

    const offset = document.offsetAt(position);
    const fileName = uriToFsPath(uri);
    const body = languageService.getCompletionsAtPosition(toVirtualPath(fileName), offset, {
      includeCompletionsWithInsertText: true,
    });

    if (!body) {
      return;
    }

    const {
      isNewIdentifierLocation,
      // optionalReplacementSpan,
    } = body;

    // const wordRange: Range = optionalReplacementSpan ? {
    //   start: document.positionAt(optionalReplacementSpan.start),
    //   end: document.positionAt(optionalReplacementSpan.start + optionalReplacementSpan.length),
    // } : undefined;

    const completionItems: CompletionItem[] = body.entries.map((entry) => {
      let item: CompletionItem = {
        label: entry.name,
        kind: convertKind(entry.kind),
        sortText: entry.sortText,
        insertText: entry.insertText,
        preselect: entry.isRecommended,
        commitCharacters: getCommitCharacters(entry),
      };

      item = convertItem(entry, item);

      return item;
    });

    return completionItems;

    function convertItem(tsEntry: ts.CompletionEntry, item: CompletionItem) {
      if (tsEntry.kindModifiers) {
        const kindModifiers = parseKindModifier(tsEntry.kindModifiers);
        if (!item.filterText) {
          item.filterText = item.label;
        }

        if (!item.insertText) {
          item.insertText = item.label;
        }
        item.label += '?';

        if (kindModifiers.has(PConst.KindModifiers.deprecated)) {
          item.tags = [CompletionItemTag.Deprecated];
        }

        if (kindModifiers.has(PConst.KindModifiers.color)) {
          item.kind = CompletionItemKind.Color;
        }

        if (tsEntry.kind === PConst.Kind.script) {
          for (const extModifier of PConst.KindModifiers.fileExtensionKindModifiers) {
            if (kindModifiers.has(extModifier)) {
              if (tsEntry.name.toLowerCase().endsWith(extModifier)) {
                item.detail = tsEntry.name;
              } else {
                item.detail = tsEntry.name + extModifier;
              }
              break;
            }
          }
        }
      }

      if (isNewIdentifierLocation && tsEntry.replacementSpan) {
        item.textEdit = TextEdit.replace({
          start: document!.positionAt(tsEntry.replacementSpan.start),
          end: document!.positionAt(tsEntry.replacementSpan.start + tsEntry.replacementSpan.length),
        }, item.insertText ?? item.label);
      }

      return item;
    }

    function getCommitCharacters(entry: ts.CompletionEntry) {
      if (isNewIdentifierLocation) {
        return;
      }

      const commitCharacters: string[] = [];
      switch (entry.kind) {
        case PConst.Kind.memberGetAccessor:
        case PConst.Kind.memberSetAccessor:
        case PConst.Kind.constructSignature:
        case PConst.Kind.callSignature:
        case PConst.Kind.indexSignature:
        case PConst.Kind.enum:
        case PConst.Kind.interface:
          commitCharacters.push('.', ';');
          break;

        case PConst.Kind.module:
        case PConst.Kind.alias:
        case PConst.Kind.const:
        case PConst.Kind.let:
        case PConst.Kind.variable:
        case PConst.Kind.localVariable:
        case PConst.Kind.memberVariable:
        case PConst.Kind.class:
        case PConst.Kind.function:
        case PConst.Kind.method:
        case PConst.Kind.keyword:
        case PConst.Kind.parameter:
          commitCharacters.push('.', ',', ';', '(');
          break;
      }
      return commitCharacters.length === 0 ? undefined : commitCharacters;
    }
  };
}

function shouldTrigger(pre: string, context: CompletionContext) {
  if (context.triggerCharacter) {
    if (context.triggerCharacter === '"' || context.triggerCharacter === '\'') {
      // make sure we are in something that looks like the start of an import
      if (!/\b(from|import)\s*["']$/.test(pre) && !/\b(import|require)\(['"]$/.test(pre)) {
        return false;
      }
    }
    if (context.triggerCharacter === '/') {
      // make sure we are in something that looks like an import path
      if (!/\b(from|import)\s*["'][^'"]*$/.test(pre) && !/\b(import|require)\(['"][^'"]*$/.test(pre)) {
        return false;
      }
    }

    if (context.triggerCharacter === '<') {
      return false;
    }
  }

  return true;
}

function convertKind(kind: string): CompletionItemKind {
  switch (kind) {
    case PConst.Kind.primitiveType:
    case PConst.Kind.keyword:
      return CompletionItemKind.Keyword;

    case PConst.Kind.const:
    case PConst.Kind.let:
    case PConst.Kind.variable:
    case PConst.Kind.localVariable:
    case PConst.Kind.alias:
    case PConst.Kind.parameter:
      return CompletionItemKind.Variable;

    case PConst.Kind.memberVariable:
    case PConst.Kind.memberGetAccessor:
    case PConst.Kind.memberSetAccessor:
      return CompletionItemKind.Field;

    case PConst.Kind.function:
    case PConst.Kind.localFunction:
      return CompletionItemKind.Function;

    case PConst.Kind.method:
    case PConst.Kind.constructSignature:
    case PConst.Kind.callSignature:
    case PConst.Kind.indexSignature:
      return CompletionItemKind.Method;

    case PConst.Kind.enum:
      return CompletionItemKind.Enum;

    case PConst.Kind.enumMember:
      return CompletionItemKind.EnumMember;

    case PConst.Kind.module:
    case PConst.Kind.externalModuleName:
      return CompletionItemKind.Module;

    case PConst.Kind.class:
    case PConst.Kind.type:
      return CompletionItemKind.Class;

    case PConst.Kind.interface:
      return CompletionItemKind.Interface;

    case PConst.Kind.warning:
      return CompletionItemKind.Text;

    case PConst.Kind.script:
      return CompletionItemKind.File;

    case PConst.Kind.directory:
      return CompletionItemKind.Folder;

    case PConst.Kind.string:
      return CompletionItemKind.Constant;

    default:
      return CompletionItemKind.Property;
  }
}
