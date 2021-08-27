export interface ServerInitializationOptions {
  appRoot: string;
}

export type Language = 'jsx' | 'js' | 'tsx' | 'ts';

export interface VirtualFile {
  uri: string;
  lang: Language
}
