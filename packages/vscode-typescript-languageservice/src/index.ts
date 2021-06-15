import type { LanguageServiceHost } from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import * as fg from 'fast-glob';
import {
  fsPathToUri,
  uriToFsPath,
  normalizeFileName,
  toVirtualPath,
} from '@dali/shared';
import type { TextDocuments, Position } from 'vscode-languageserver/node';
import * as hover from './languageFeatures/hover';
import * as definitions from './languageFeatures/definitions';
import * as completions from './languageFeatures/completions';
import { createSourceFile, location } from './sourceFile';

export * from './sourceFile';

// export type LanguageService = ReturnType<typeof createLanguageService>;

export function createLanguageService(
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[],
) {
  let projectVersion = 0;
  const tsConfigNames = ['tsconfig.json'];
  const snapshots = new Map<string, {
    version: string
    snapshot: ts.IScriptSnapshot
  }>();
  const tsConfigSet = new Set(
    folders
      .map((folder) => ts.sys.readDirectory(folder, tsConfigNames, undefined, ['**/*']))
      .flat(),
  );
  const tsConfigs = [...tsConfigSet].filter((tsConfig) => tsConfigNames.includes(path.basename(tsConfig)));
  let parsedCommandLine: ts.ParsedCommandLine;
  const mds = new Map<string, { version: number, fileName: string }>();
  const documentsMap = new Map<string, { version: number, document: TextDocument }>();
  folders
    .map((folder) => fg.sync(`${folder}/components/**/*.md`))
    .flat()
    .forEach((fileName) => {
      mds.set(fileName, { version: 0, fileName: toVirtualPath(fileName) });
    });

  update();

  const host = createTsLanguageServiceHost();
  const languageService = ts.createLanguageService(
    host,
    ts.createDocumentRegistry(),
  );

  return {
    dispose,
    doHover: hover.register(languageService, getTextDocument, ts),
    doCompletion: completions.register(languageService, getTextDocument),
    findDefinitions: definitions.register(languageService, getTextDocument),
    onDocumentUpdate,
    getVirtualDocumentInfo,
    update,
  };

  function update() {
    parsedCommandLine = createParsedCommandLine(
      ts,
      tsConfigs[0],
    );

    for (const fileName of parsedCommandLine.fileNames) {
      if (!mds.has(fileName)) {
        mds.set(fileName, {
          version: 0,
          fileName: toVirtualPath(fileName),
        });
      }
    }
  }

  function dispose() {
    languageService.dispose();
  }

  function getVirtualDocumentInfo(uri: string, _position: Position) {
    const fileName = toVirtualPath(uriToFsPath(uri));
    const res: {
      uri: string;
      fileName: string;
      position: Position
    } = {
      uri,
      fileName,
      position: _position,
    };
    const loc = location.get(fileName);
    if (loc?.start) {
      res.position.line = _position.line - loc.start.line;
    }
    return res;
  }

  function createTsLanguageServiceHost() {
    mds.values();
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
        ...([...mds.values()].map(({ fileName }) => fileName)),
      ],
      getScriptVersion,
      getCurrentDirectory: () => path.dirname(tsConfigs[0]),
      getScriptSnapshot,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    };
    return serviceHost;
  }

  function fileExists(_fileName: string) {
    const fileName = normalizeFileName(
      ts.sys.realpath?.(_fileName) ?? _fileName,
    );
    const exists = !!ts.sys.fileExists?.(fileName);

    return exists;
  }

  function getScriptVersion(fileName: string) {
    return `${mds.get(fileName)?.version || 0}`;
  }

  function getScriptSnapshot(fileName: string) {
    const version = getScriptVersion(fileName);
    const cache = snapshots.get(fileName);
    if (cache?.version === version) {
      return cache.snapshot;
    }
    const text = getScriptText(fileName);
    if (text !== undefined) {
      const snapshot = ts.ScriptSnapshot.fromString(text);
      snapshots.set(fileName, {
        version: `${version}`,
        snapshot,
      });
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
      return createSourceFile(fileName);
    }
  }

  function getTextDocument(uri: string) {
    const fileName = uriToFsPath(uri);
    if (!languageService.getProgram()?.getSourceFile(fileName)) {
      return;
    }
    const version = host.getScriptVersion(fileName);
    const prev = documentsMap.get(fileName);
    if (prev?.version !== Number(version)) {
      const scriptSnapshot = host.getScriptSnapshot(fileName);
      if (scriptSnapshot) {
        const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
        const newVersion = prev?.version ? prev.version + 1 : 0;
        const document = TextDocument.create(uri, 'typescript', newVersion, scriptText);
        documentsMap.set(fileName, {
          version: newVersion,
          document,
        });
      }
    }
    return documentsMap.get(fileName)?.document;
  }

  function onDocumentUpdate(document: TextDocument) {
    const fileName = uriToFsPath(document.uri);
    const snapshot = snapshots.get(fileName);
    if (snapshot) {
      const snapshotLength = snapshot.snapshot.getLength();
      const documentText = createSourceFile(fileName);
      if (
        snapshotLength === documentText.length
        && snapshot.snapshot.getText(0, snapshotLength) === documentText
      ) {
        return;
      }
    }
    const md = mds.get(fileName);
    if (md) {
      md.version++;
      projectVersion++;
    }
  }
}

function createParsedCommandLine(
  ts: typeof import('typescript/lib/tsserverlibrary'),
  tsConfig: string,
) {
  const parseConfigHost: ts.ParseConfigHost = {
    ...ts.sys,
    readDirectory: ts.sys.readDirectory,
  };
  const realTsConfig = ts.sys.realpath!(tsConfig);
  const config = ts.readJsonConfigFile(realTsConfig, ts.sys.readFile);
  const content = ts.parseJsonSourceFileConfigFileContent(
    config,
    parseConfigHost,
    path.dirname(realTsConfig),
    {},
    path.basename(realTsConfig),
  );
  content.options.outDir = undefined;
  content.fileNames = content.fileNames.map(normalizeFileName);
  return content;
}
