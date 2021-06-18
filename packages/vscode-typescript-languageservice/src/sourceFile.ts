import { parse, SourceLocation } from '@dali/shared';

const location = new Map<string, SourceLocation>();

export function createSourceFile(fileName: string, content: string) {
  const { source = '', ...rest } = parse(content);
  location.set(fileName, rest);
  return source;
}

export { location };
