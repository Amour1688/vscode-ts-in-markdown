/* eslint-disable no-plusplus */
import { Language } from './interface';

export interface Position {
  offset: number;
  line: number;
  column: number;
}

export interface Location {
  start?: Position;
  end?: Position;
}

export interface SourceLocation {
  locations: Location[];
  contents: string[];
}

export interface ParsedMarkdown {
  location: Location;
  content: string;
  language: Language;
}

function isCode<T extends Language>(
  source: string,
  lang: T,
  start: number,
): T | false {
  return source.slice(start, start + lang.length) === lang && lang;
}

function isBlock(source: string, cursor: number) {
  return source.slice(cursor, cursor + 3) === '```';
}

export function parse(_source: string): ParsedMarkdown[] {
  let i = 0;
  let line = 0;
  let column = 0;
  let shouldReplace = true;
  let location: Location | undefined = {};
  let lang: Language | false = false;

  const results: string[] = [];
  const parsedMarkdowns: ParsedMarkdown[] = [];

  while (i < _source.length) {
    const isLineBreak = _source[i] === '\n';
    results[i] = shouldReplace && !isLineBreak ? ' ' : _source[i];

    i++;
    column++;
    if (isLineBreak) {
      line++;
      column = 0;
    }

    if (isBlock(_source, i)) {
      lang = isCode(_source, 'tsx', i + 3)
        || isCode(_source, 'jsx', i + 3)
        || isCode(_source, 'js', i + 3)
        || isCode(_source, 'ts', i + 3);
      if (!lang) {
        continue;
      }
      // ```tsx live=true
      while (i < _source.length && _source[i] !== '\n') {
        results[i] = ' ';
        i++;
      }
      shouldReplace = false;
      location = {
        start: {
          line: line + 1,
          column,
          offset: i + 1,
        },
      };
    } else if (location?.start?.line && isBlock(_source, i + 3)) {
      while (i < _source.length && _source[i] !== '\n') {
        results[i] = _source[i];
        i++;
      }
      location.end = {
        line,
        column,
        offset: i,
      };

      shouldReplace = true;

      parsedMarkdowns.push({
        location,
        content: results.join(''),
        language: lang as Language,
      });

      for (const index in results) {
        if (results[index] !== '\n') {
          results[index] = ' ';
        }
      }

      lang = false;
      location = undefined;
    }
  }
  return parsedMarkdowns;
}
