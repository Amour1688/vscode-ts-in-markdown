import type { LanguageServiceHost } from 'typescript'
import * as ts from 'typescript'
import { register as doHover } from './services/hover'

export function createLanguageService(ts: typeof import('typescript/lib/tsserverlibrary'), _host?: LanguageServiceHost, ) {
  const host = {
    ...createTsLanguageServiceHost(),
    ..._host,
  }
  const languageService = ts.createLanguageService(host)

  return {
    dispose,
    doHover
  }

  function dispose() {
		languageService.dispose();
	}

  function createTsLanguageServiceHost() {
    const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
    const host: LanguageServiceHost = {
      // ts
			getNewLine: () => ts.sys.newLine,
			useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
			readFile: ts.sys.readFile,
			writeFile: ts.sys.writeFile,
			directoryExists: ts.sys.directoryExists,
			getDirectories: ts.sys.getDirectories,
			readDirectory: ts.sys.readDirectory,
			realpath: ts.sys.realpath,
      getCompilationSettings: () => ({}),
      getScriptFileNames: () => [],
      getScriptVersion: () => '',
      getCurrentDirectory: () => '',
      getScriptSnapshot: () => undefined,
      getDefaultLibFileName: () => ''
    }
    return host
  }
}
