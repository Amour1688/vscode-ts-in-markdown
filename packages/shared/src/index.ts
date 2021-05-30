export * from './interface'

import * as path from 'path'

export function loadTypeScript(appRoot: string): typeof import('typescript/lib/tsserverlibrary') {
  const tsPath = path.join(appRoot, 'extensions', 'node_modules', 'typescript');
  return require(tsPath);
}
