import { parse, SourceLocation } from '@ts-in-markdown/shared';

const location = new Map<string, SourceLocation>(); // virtual path

export function createSourceFile(fileName: string, content: string) {
  const { source = '', ...rest } = parse(content);
  location.set(fileName, rest);
  return source;
}

export { location };
