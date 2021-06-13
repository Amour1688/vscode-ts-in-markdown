import * as fs from 'fs';
import { parse, SourceLocation } from '@dali/shared';

const location = new Map<string, SourceLocation>();

export function createSourceFile(fileName: string) {
  const { source = '', ...rest } = parse(
    fs.readFileSync(fileName.replace('.__TS.tsx', '')).toString(),
  );
  location.set(fileName, rest);
  return source;
}

export {
  location,
};
