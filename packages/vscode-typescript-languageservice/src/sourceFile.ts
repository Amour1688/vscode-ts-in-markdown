import { parse, Location } from '@ts-in-markdown/shared';

export const locationMap = new Map<string, Location[]>(); // virtual path

export function parseSourceFile(fileName: string, content: string) {
  const { source = '', locations } = parse(content);
  locationMap.set(fileName, locations);
  return source;
}
