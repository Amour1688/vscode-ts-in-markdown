import { LanguageServiceHost } from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import * as fg from 'fast-glob';
import {
  fsPathToUri,
  uriToFsPath,
  normalizeFileName,
  toVirtualPath,
  toRealFilePath,
  parseMarkdown,
} from '@ts-in-markdown/shared';
import { TextDocuments } from 'vscode-languageserver/node';
import * as hover from './languageFeatures/hover';
import * as definitions from './languageFeatures/definitions';
import * as completion from './languageFeatures/completion';
import * as completionResolve from './languageFeatures/completionResolve';
import * as typeDefinition from './languageFeatures/typeDefinition';
import * as diagnostics from './languageFeatures/diagnostics';
import * as formatting from './languageFeatures/formatting';
import * as folding from './languageFeatures/folding';
import * as references from './languageFeatures/references';

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
  const mdMap = new Map<string, { version: number, fileName: string }>();
  const virtualMap = new Map<string, string>();
  const tsFiles = new Map<string, { version: number; fileName: string }>();
  const documentsMap = new Map<string, { version: number, document: TextDocument }>();

  update();

  const host = createTsLanguageServiceHost();
  const languageService = ts.createLanguageService(
    host,
    ts.createDocumentRegistry(),
  );

  return {
    dispose,
    doHover: hover.register(languageService, getTextDocument, ts),
    doCompletion: completion.register(languageService, getTextDocument),
    doValidation: diagnostics.register(languageService, getTextDocument, ts),
    doCompletionResolve: completionResolve.register(),
    doFormatting: formatting.register(languageService, getTextDocument),
    doFolding: folding.register(languageService, getTextDocument),
    fineTypeDefinition: typeDefinition.register(languageService, getTextDocument),
    findDefinitions: definitions.register(languageService, getTextDocument),
    findReferences: references.register(languageService, getTextDocument),
    onDocumentUpdate,
    update,
  };

  function update() {
    const mds = folders
      .map((folder) => [...fg.sync(`${folder}/**/*.md`, { ignore: ['**/node_modules/**'] })])
      .flat();

    const mdSet = new Set(mds);
    for (const [markdown] of mdMap) {
      if (!mdSet.has(markdown)) {
        mdMap.delete(markdown);
      }
    }

    let change = false;
    mds.forEach((markdown) => {
      const virtualName = toVirtualPath(markdown);
      if (!mdMap.has(virtualName)) {
        mdMap.set(markdown, { version: 0, fileName: virtualName });
        virtualMap.set(virtualName, markdown);
        change = true;
      }
    });

    parsedCommandLine = createParsedCommandLine(
      ts,
      tsConfigs[0],
    );

    const fileNames = new Set(parsedCommandLine.fileNames);
    for (const [fileName] of tsFiles) {
      if (!fileNames.has(fileName)) {
        tsFiles.delete(fileName);
      }
    }

    for (const fileName of parsedCommandLine.fileNames) {
      if (!tsFiles.has(fileName)) {
        tsFiles.set(fileName, {
          version: 0,
          fileName,
        });
        change = true;
      }
    }

    if (change) {
      projectVersion++;
    }
  }

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
        ...([...mdMap.values()].map(({ fileName }) => fileName)),
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
    return !!ts.sys.fileExists?.(fileName);
  }

  function getScriptVersion(fileName: string) {
    const virtual = virtualMap.get(fileName);
    return `${virtual ? mdMap.get(virtual)?.version : tsFiles.get(fileName)?.version || 0}`;
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
    const doc = documents.get(fsPathToUri(toRealFilePath(fileName)));
    if (doc) {
      return virtualMap.has(fileName) ? parseMarkdown(fileName, doc.getText()) : doc.getText();
    }
    if (ts.sys.fileExists(fileName)) {
      return ts.sys.readFile(fileName, 'utf8');
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
    const fsPath = uriToFsPath(document.uri);
    const markdown = mdMap.get(fsPath);
    const fileName = markdown ? markdown.fileName : fsPath;
    const snapshot = snapshots.get(fileName);
    if (snapshot) {
      const snapshotLength = snapshot.snapshot.getLength();
      const documentText = markdown ? parseMarkdown(fileName, document.getText()) : document.getText();
      if (
        snapshotLength === documentText.length
        && snapshot.snapshot.getText(0, snapshotLength) === documentText
      ) {
        return;
      }
    }
    const file = markdown ?? tsFiles.get(fsPath);
    if (file) {
      file.version++;
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
