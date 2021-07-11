/* eslint-disable no-plusplus */
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
  source?: string;
}

function isCode(source: string, lang: string, start: number) {
  return source.slice(start, start + lang.length) === lang;
}

function isBlock(source: string, cursor: number) {
  return source.slice(cursor, cursor + 3) === '```';
}

export function parse(_source: string) {
  let i = 0;
  let line = 0;
  let column = 0;
  let shouldReplace = true;
  let location: Location | undefined = {};
  const sourceLocation: SourceLocation = {
    locations: [],
  };
  const results: string[] = [];

  while (i < _source.length) {
    const isLineBreak = _source[i] === '\n';
    results[i] = shouldReplace && !isLineBreak ? ' ' : _source[i];

    i++;
    column++;
    if (isLineBreak) {
      line++;
      column = 0;
    }

    if (isBlock(_source, i) && (isCode(_source, 'jsx', i + 3) || isCode(_source, 'tsx', i + 3))) {
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
      sourceLocation.locations.push(location);
      location = undefined;
    }
    sourceLocation.source = results.join('');
  }
  return sourceLocation;
}
