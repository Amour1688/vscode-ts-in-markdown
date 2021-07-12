import {
  HoverRequest,
  DefinitionRequest,
  Connection,
  TypeDefinitionRequest,
  CompletionRequest,
  ReferencesRequest,
  TextDocumentRegistrationOptions,
  FoldingRangeRequest,
} from 'vscode-languageserver/node';

const markdownReg: TextDocumentRegistrationOptions = {
  documentSelector: [{ scheme: 'file', language: 'markdown' }],
};

export function register(connect: Connection) {
  connect.client.register(DefinitionRequest.type, markdownReg);
  connect.client.register(TypeDefinitionRequest.type, markdownReg);
  connect.client.register(TypeDefinitionRequest.type, markdownReg);
  connect.client.register(HoverRequest.type, markdownReg);
  connect.client.register(ReferencesRequest.type, markdownReg);
  connect.client.register(CompletionRequest.type, {
    documentSelector: markdownReg.documentSelector,
    triggerCharacters: ['.', '\'', '"', '`'],
    resolveProvider: true,
  });
  connect.client.register(FoldingRangeRequest.type, markdownReg);
}
