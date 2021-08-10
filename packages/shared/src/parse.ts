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
  contents: string[];
}

export const locationMap = new Map<string, Location[]>(); // virtual path

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

  const results: string[] = [];
  const sourceLocation: SourceLocation = {
    locations: [],
    contents: [],
  };

  while (i < _source.length) {
    const isLineBreak = _source[i] === '\n';
    results[i] = shouldReplace && !isLineBreak ? ' ' : _source[i];

    i++;
    column++;
    if (isLineBreak) {
      line++;
      column = 0;
    }

    if (isBlock(_source, i) && (isCode(_source, 'tsx', i + 3))) {
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
      sourceLocation.contents.push(results.join(''));

      for (const index in results) {
        if (results[index] !== '\n') {
          results[index] = ' ';
        }
      }

      location = undefined;
    }
  }
  return sourceLocation;
}

export function parseMarkdown(fileName: string, content: string) {
  const { contents = [], locations } = parse(content);
  locationMap.set(fileName, locations);
  return contents;
}
