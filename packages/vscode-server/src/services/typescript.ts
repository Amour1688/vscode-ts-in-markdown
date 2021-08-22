import { Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageServiceHost } from 'typescript';
import { TextDocuments } from 'vscode-languageserver';
import {
  fsPathToUri,
  uriToFsPath,
  normalizeFileName,
  toVirtualPath,
  parse,
  ParsedMarkdown,
  Language,
  languageIdMap,
} from '@ts-in-markdown/shared';
import * as fg from 'fast-glob';
import * as path from 'path';

export function createTSLanguageService(
  ts: typeof import('typescript/lib/tsserverlibrary'),
  documents: TextDocuments<TextDocument>,
  folders: string[],
) {
  let projectVersion = 0;
  const tsConfigNames = ['tsconfig.json', 'jsconfig.json'];
  const snapshots = new Map<
  string,
  {
    version: string;
    snapshot: ts.IScriptSnapshot;
  }
  >();

  const tsConfigSet = new Set(
    folders
      .map((folder) => ts.sys.readDirectory(folder, tsConfigNames, undefined, ['**/*']))
      .flat(),
  );
  const tsConfigs = [...tsConfigSet].filter((tsConfig) => tsConfigNames.includes(path.basename(tsConfig)));
  let parsedCommandLine: ts.ParsedCommandLine | undefined;
  const mdMap = new Map<
  string,
  {
    version: number;
    fileName: string;
    parsedMarkdowns?: ParsedMarkdown[];
  }
  >();
  const virtualMap = new Map<
  string,
  {
    originFileName: string;
    blockIndex: number;
    version: number;
  }
  >();
  const tsFiles = new Map<string, { version: number; fileName: string }>();
  const documentsMap = new Map<
  string,
  { version: number; document: TextDocument }
  >();

  update();

  const host = createTsLanguageServiceHost();
  const languageService = ts.createLanguageService(
    host,
    ts.createDocumentRegistry(),
  );

  function update() {
    const mds = folders
      .map((folder) => [
        ...fg.sync(`${folder}/**/*.md`, { ignore: ['**/node_modules/**'] }),
      ])
      .flat();

    const mdSet = new Set(mds);
    for (const [markdown] of mdMap) {
      if (!mdSet.has(markdown)) {
        const value = mdMap.get(markdown);
        value?.parsedMarkdowns?.forEach(({ language }, i) => {
          virtualMap.delete(toVirtualPath(markdown, i, language));
        });
        mdMap.delete(markdown);
      }
    }

    let change = false;

    mds.forEach((md) => {
      if (!mdMap.has(md)) {
        mdMap.set(md, { version: 0, fileName: md });
        change = true;
      }
    });

    if (tsConfigs[0]) {
      parsedCommandLine = createParsedCommandLine(ts, tsConfigs[0]);
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
    }

    if (change) {
      projectVersion++;
    }
  }

  return {
    dispose,
    update,
    getTextDocument,
    onDocumentUpdate,
    virtualMap,
    host,
    languageService,
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
      getCompilationSettings: () => parsedCommandLine?.options ?? {},
      getProjectVersion: () => `${projectVersion}`,
      getScriptFileNames: () => [
        ...(parsedCommandLine?.fileNames || []),
        ...[...mdMap.values()]
          .map(({ fileName, parsedMarkdowns = [] }) => parsedMarkdowns.map((_, i) => toVirtualPath(fileName, i)))
          .flat(),
      ],
      getScriptVersion,
      getCurrentDirectory: () => (tsConfigs[0] ? path.dirname(tsConfigs[0]) : ''),
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
    return `${
      (virtual ? virtual.version : tsFiles.get(fileName)?.version) || 0
    }`;
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

  function getScriptText(fileName: string): string | undefined {
    const virtual = virtualMap.get(fileName);
    if (virtual) {
      const { originFileName, blockIndex } = virtual;
      const markdown = mdMap.get(originFileName);
      if (markdown) {
        const { parsedMarkdowns = [] } = markdown;
        return parsedMarkdowns[blockIndex].content;
      }
    }
    const doc = documents.get(fsPathToUri(fileName));
    if (doc) {
      return doc.getText();
    }

    if (ts.sys.fileExists(fileName)) {
      return ts.sys.readFile(fileName, 'utf8');
    }
  }

  function getTextDocument(
    uri: string,
    position: Position
  ): { document: TextDocument | undefined; virtualFsPath: string } | undefined;
  function getTextDocument(
    uri: string
  ): (TextDocument | undefined)[] | undefined;
  function getTextDocument(uri: string, position?: Position) {
    const fsPath = uriToFsPath(uri);
    const markdown = mdMap.get(fsPath);
    const files: { fileName: string; lang?: keyof typeof languageIdMap }[] = [];
    let blockIndex: number = -1;
    if (markdown) {
      const document = documents.get(uri);
      if (!document) {
        return;
      }
      const { parsedMarkdowns = [] } = markdown;
      const saveFile = (index: number, lang: Language) => {
        files.push({
          fileName: toVirtualPath(fsPath, index),
          lang,
        });
      };

      if (position) {
        blockIndex = parsedMarkdowns.findIndex(
          ({ location }) => location.start!.line <= position.line
            && location.end!.line >= position.line,
        );

        if (blockIndex !== -1) {
          saveFile(blockIndex, parsedMarkdowns[blockIndex].language);
        }
      } else {
        parsedMarkdowns.forEach(({ language }, index) => {
          saveFile(index, language);
        });
      }

      if (!files.length) {
        return;
      }
    } else {
      files.push({
        fileName: fsPath,
      });
    }

    const textDocuments: (TextDocument | undefined)[] = [];
    for (const { fileName, lang = 'tsx' } of files) {
      if (!languageService.getProgram()?.getSourceFile(fileName)) {
        continue;
      }
      const version = host.getScriptVersion(fileName);
      const prev = documentsMap.get(fileName);
      if (prev?.version !== Number(version)) {
        const scriptSnapshot = host.getScriptSnapshot(fileName);
        if (scriptSnapshot) {
          const scriptText = scriptSnapshot.getText(
            0,
            scriptSnapshot.getLength(),
          );
          const newVersion = typeof prev?.version === 'number' ? prev.version + 1 : 0;
          const document = TextDocument.create(
            fsPathToUri(fileName),
            languageIdMap[lang] ?? 'typescript',
            newVersion,
            scriptText,
          );
          documentsMap.set(fileName, {
            version: newVersion,
            document,
          });
        }
      }
      textDocuments.push(documentsMap.get(fileName)?.document);
    }

    return position
      ? { document: textDocuments[0], virtualFsPath: files[0].fileName }
      : textDocuments;
  }

  function onDocumentUpdate(document: TextDocument) {
    const fsPath = uriToFsPath(document.uri);
    const markdown = mdMap.get(fsPath);
    const fileNames: string[] = [];
    if (markdown) {
      const parsedMarkdowns = parse(document.getText());
      if (parsedMarkdowns.length) {
        Object.assign(markdown, { parsedMarkdowns });
        parsedMarkdowns.forEach((_, blockIndex) => {
          const fileName = toVirtualPath(fsPath, blockIndex);
          if (!virtualMap.has(fileName)) {
            virtualMap.set(fileName, {
              originFileName: fsPath,
              blockIndex,
              version: 0,
            });
          }
          fileNames.push(fileName);
        });
      }
    } else {
      fileNames.push(fsPath);
    }

    let change = false;
    for (const fileName of fileNames) {
      const snapshot = snapshots.get(fileName);
      if (snapshot) {
        const snapshotLength = snapshot.snapshot.getLength();
        const documentText = markdown
          ? (markdown.parsedMarkdowns || [])[
            virtualMap.get(fileName)!.blockIndex
          ].content
          : document.getText();
        if (
          snapshotLength === documentText.length
          && snapshot.snapshot.getText(0, snapshotLength) === documentText
        ) {
          continue;
        }
        change = true;
        const file = virtualMap.get(fileName) ?? tsFiles.get(fsPath);
        if (file) {
          file.version++;
        }
      } else {
        change = true;
      }
    }
    if (change) {
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
