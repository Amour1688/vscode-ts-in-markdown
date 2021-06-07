import type { LanguageServiceHost } from 'typescript';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import * as fs from 'fs';
import * as fg from 'fast-glob';
import { fsPathToUri, uriToFsPath, normalizeFileName } from '@dali/shared';
import type { TextDocuments } from 'vscode-languageserver/node';
import * as hover from './services/hover';

export function createLanguageService(
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[],
) {
  const projectVersion = 0;
  let parsedCommandLine: ts.ParsedCommandLine;
  const tsConfigNames = ['tsconfig.json'];
  const tsConfigSet = new Set(folders.map((folder) => ts.sys.readDirectory(folder, tsConfigNames, undefined, ['**/*'])).flat());
  const tsConfigs = [...tsConfigSet].filter((tsConfig) => tsConfigNames.includes(path.basename(tsConfig)));
  parsedCommandLine = createParsedCommandLine(ts, tsConfigs[0]);
  const mds = folders.map((folder) => fg.sync(`${folder}/components/**/*.md`)).flat();
  const host = createTsLanguageServiceHost();
  const languageService = ts.createLanguageService(host, ts.createDocumentRegistry());

  return {
    dispose,
    doHover: hover.register(languageService, getTextDocument, ts),
  };

  function dispose() {
    languageService.dispose();
  }

  function createTsLanguageServiceHost() {
    const serviceHost: LanguageServiceHost = {
      // ts
      getNewLine: () => ts.sys.newLine,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
      readFile: ts.sys.readFile,
      writeFile: ts.sys.writeFile,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      readDirectory: ts.sys.readDirectory,
      realpath: ts.sys.realpath,
      fileExists,
      getCompilationSettings: () => parsedCommandLine.options,
      getProjectVersion: () => `${projectVersion}`,
      getScriptFileNames: () => [
        ...parsedCommandLine.fileNames,
        ...mds.map((md) => `${md}.__TS.tsx`),
      ],
      getScriptVersion: () => '',
      getCurrentDirectory: () => path.dirname(tsConfigs[0]),
      getScriptSnapshot,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    };
    return serviceHost;
  }

  function fileExists(_fileName: string) {
    const fileName = normalizeFileName(ts.sys.realpath?.(_fileName) ?? _fileName);
    const exists = !!ts.sys.fileExists?.(fileName);

    return exists;
  }

  function getScriptSnapshot(fileName: string) {
    const text = getScriptText(fileName);
    if (text !== undefined) {
      return ts.ScriptSnapshot.fromString(text);
    }
  }

  function getScriptText(fileName: string) {
    const doc = documents.get(fsPathToUri(fileName));
    if (doc) {
      return doc.getText();
    }
    if (ts.sys.fileExists(fileName)) {
      return ts.sys.readFile(fileName, 'utf8');
    }
    if (fileName.endsWith('.__TS.tsx')) {
      const content = fs.readFileSync(fileName.replace('.__TS.tsx', '')).toString();
      return content.match(/```(?:jsx|tsx)\n([\s\S]*?)```$/m)?.[1];
    }
  }

  function getTextDocument(uri: string) {
    const fileName = uriToFsPath(uri);
    if (!languageService.getProgram()?.getSourceFile(fileName)) {
      return;
    }
    return documents.get(uri);
  }
}

function createParsedCommandLine(ts: typeof import('typescript/lib/tsserverlibrary'), tsConfig: string) {
  const parseConfigHost: ts.ParseConfigHost = {
    ...ts.sys,
    readDirectory: ts.sys.readDirectory,
  };
  const realTsConfig = ts.sys.realpath!(tsConfig);
  const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
  const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(realTsConfig), {}, path.basename(realTsConfig));
  content.options.outDir = undefined;
  content.fileNames = content.fileNames.map(normalizeFileName);
  return content;
}
