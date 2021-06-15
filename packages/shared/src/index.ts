import * as path from 'path';
import { URI } from 'vscode-uri';

export * from './interface';
export * from './parse';

export function loadTypeScript(appRoot: string): typeof import('typescript/lib/tsserverlibrary') {
  const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
  // eslint-disable-next-line
  return require(tsPath);
}

export function uriToFsPath(uri: string) {
  return URI.parse(uri).fsPath;
}

export function fsPathToUri(fsPath: string) {
  return URI.file(fsPath).toString();
}

export function normalizeFileName(fileName: string) {
  return uriToFsPath(fsPathToUri(fileName));
}

export function toVirtualPath(fileName: string) {
  return `${fileName}.__TS.tsx`;
}
