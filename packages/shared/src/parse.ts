/* eslint-disable no-plusplus */
export interface Position {
  offset: number;
  line: number;
  column: number;
}

export interface SourceLocation {
  start?: Position;
  end?: Position;
  source?: string;
}

function isCode(source: string, lang: string, start: number) {
  return source.slice(start, start + lang.length) === lang;
}

function isBlock(source: string, cursor: number) {
  return source.slice(cursor, cursor + 3) === '```';
}

export function parse(source: string) {
  let i = 0;
  const loc: SourceLocation = {};
  let line = 0;
  let column = 0;
  while (i < source.length) {
    i++;
    column++;
    if (source[i] === '\n') {
      line++;
      column = 0;
    }

    if (isBlock(source, i) && (isCode(source, 'jsx', i + 3) || isCode(source, 'tsx', i + 3))) {
      loc.start = {
        line: line + 1,
        column,
        offset: i + 7,
      };
    } else if (loc.start?.line && isBlock(source, i + 3)) {
      loc.end = {
        line: line + 1,
        column,
        offset: i + 3,
      };
      loc.source = source.slice(loc.start.offset, loc.end.offset);
    }
  }
  return loc;
}
