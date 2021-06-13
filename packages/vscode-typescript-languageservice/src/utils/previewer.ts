/* eslint-disable no-param-reassign */
/* eslint-disable no-case-declarations */
/* eslint-disable default-case */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type * as Proto from '../protocol';

export interface IFilePathToResourceConverter {
/**
 * Convert a typescript filepath to a VS Code resource.
 */
  toResource(filepath: string): vscode.Uri;
}

function replaceLinks(text: string): string {
  return text
  // Http(s) links
    .replace(/\{@(link|linkplain|linkcode) (https?:\/\/[^ |}]+?)(?:[| ]([^{}\n]+?))?\}/gi, (_, tag: string, link: string, _text?: string) => {
      switch (tag) {
        case 'linkcode':
          return `[\`${_text ? _text.trim() : link}\`](${link})`;

        default:
          return `[${_text ? _text.trim() : link}](${link})`;
      }
    });
}

function processInlineTags(text: string): string {
  return replaceLinks(text);
}

function getTagBodyText(
  tag: Proto.JSDocTagInfo,
): string | undefined {
  if (!tag.text) {
    return undefined;
  }

  // Convert to markdown code block if it is not already one
  function makeCodeblock(text: string): string {
    if (text.match(/^\s*[~`]{3}/g)) {
      return text;
    }
    return `\`\`\`\n${text}\n\`\`\``;
  }

  switch (tag.name) {
    case 'example':
      // check for caption tags, fix for #79704
      const captionTagMatches = tag.text.match(/<caption>(.*?)<\/caption>\s*(\r\n|\n)/);
      if (captionTagMatches && captionTagMatches.index === 0) {
        return `${captionTagMatches[1]}\n\n${makeCodeblock(tag.text.substr(captionTagMatches[0].length))}`;
      }
      return makeCodeblock(tag.text);

    case 'author':
      // fix obsucated email address, #80898
      const emailMatch = tag.text.match(/(.+)\s<([-.\w]+@[-.\w]+)>/);

      if (emailMatch === null) {
        return tag.text;
      }
      return `${emailMatch[1]} ${emailMatch[2]}`;

    case 'default':
      return makeCodeblock(tag.text);
  }

  return processInlineTags(tag.text);
}

function getTagDocumentation(
  tag: Proto.JSDocTagInfo,
): string | undefined {
  switch (tag.name) {
    case 'augments':
    case 'extends':
    case 'param':
    case 'template':
      const body = (tag.text || '').split(/^(\S+)\s*-?\s*/);
      if (body?.length === 3) {
        const param = body[1];
        const doc = body[2];
        const label = `*@${tag.name}* \`${param}\``;
        if (!doc) {
          return label;
        }
        return label + (doc.match(/\r\n|\n/g) ? `  \n${processInlineTags(doc)}` : ` — ${processInlineTags(doc)}`);
      }
  }

  // Generic tag
  const label = `*@${tag.name}*`;
  const text = getTagBodyText(tag);
  if (!text) {
    return label;
  }
  return label + (text.match(/\r\n|\n/g) ? `  \n${text}` : ` — ${text}`);
}

export function plainWithLinks(
  parts: readonly Proto.SymbolDisplayPart[] | string,
  filePathConverter: IFilePathToResourceConverter,
): string {
  return processInlineTags(convertLinkTags(parts, filePathConverter));
}

/**
 * Convert `@link` inline tags to markdown links
 */
function convertLinkTags(
  parts: readonly Proto.SymbolDisplayPart[] | string | undefined,
  filePathConverter: IFilePathToResourceConverter,
): string {
  if (!parts) {
    return '';
  }

  if (typeof parts === 'string') {
    return parts;
  }

  const out: string[] = [];

  let currentLink: { name?: string, target?: Proto.FileSpan, text?: string } | undefined;
  for (const part of parts) {
    switch (part.kind) {
      case 'link':
        if (currentLink) {
          const text = currentLink.text ?? currentLink.name;
          if (currentLink.target) {
            const link = filePathConverter.toResource(currentLink.target.file)
              .with({
                fragment: `L${currentLink.target.start.line},${currentLink.target.start.offset}`,
              });

            out.push(`[${text}](${link.toString(true)})`);
          } else if (text) {
            out.push(text);
          }
          currentLink = undefined;
        } else {
          currentLink = {};
        }
        break;

      case 'linkName':
        if (currentLink) {
          currentLink.name = part.text;
          // TODO: remove cast once we pick up TS 4.3
          currentLink.target = (part as any as Proto.JSDocLinkDisplayPart).target;
        }
        break;

      case 'linkText':
        if (currentLink) {
          currentLink.text = part.text;
        }
        break;

      default:
        out.push(part.text);
        break;
    }
  }
  return processInlineTags(out.join(''));
}

export function tagsMarkdownPreview(
  tags: readonly Proto.JSDocTagInfo[],
): string {
  return tags.map((tag) => getTagDocumentation(tag)).join('  \n\n');
}

export function plain(parts: Proto.SymbolDisplayPart[] | string): string {
  return processInlineTags(
    typeof parts === 'string'
      ? parts
      : parts.map((part) => part.text).join(''),
  );
}

export function markdownDocumentation(
  documentation: Proto.SymbolDisplayPart[] | string | undefined,
  tags: Proto.JSDocTagInfo[] | undefined,
): string {
  return addMarkdownDocumentation('', documentation, tags);
}

export function addMarkdownDocumentation(
  out: string,
  documentation: Proto.SymbolDisplayPart[] | string | undefined,
  tags: Proto.JSDocTagInfo[] | undefined,
): string {
  if (documentation) {
    out += plain(documentation);
  }

  if (tags) {
    const tagsPreview = tagsMarkdownPreview(tags);
    if (tagsPreview) {
      out += `\n\n${tagsPreview}`;
    }
  }
  return out;
}