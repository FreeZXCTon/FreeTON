'use strict';

import {CancellationToken} from 'vscode-jsonrpc';
import {
  createConnection, IConnection, TextDocumentSyncKind,
  InitializeResult, TextDocumentIdentifier,
  TextDocumentPositionParams,
  CodeLensParams,
  CompletionItem, ServerCapabilities, CodeActionParams, Command, CodeLens,
  CompletionItemKind
} from 'vscode-languageserver';
import * as vscodeLangServer from 'vscode-languageserver';

import * as solidityproto from './protocol';
import {Settings} from './protocol';
import {SolidityProject} from './SolidityProject';

// Create a connection for the server. The connection uses
// stdin / stdout for message passing
export let connection: IConnection = createConnection();

export let project : SolidityProject = null;

let projectParams: vscodeLangServer.DidChangeTextDocumentParams = null;

// After the server has started the src sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the src capabilites.
connection.onInitialize((params): InitializeResult => {
  console.log = (e) => {connection.console.log('>>> ' + e);};
  console.info = (e) => {connection.console.info('>>> ' + e);};
  console.warn = (e) => {connection.console.warn('>>> ' + e);};
  console.error = (e) => {connection.console.error('>>> ' + e);};

  connection.console.log(`Solidity Language Server: process.version: ${process.version}, process.arch: ${process.arch}}`);

  project = new SolidityProject(params.rootPath, connection);

  return {
    capabilities: <ServerCapabilities>{
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // textDocumentSync: TextDocumentSyncKind.Full,
      // Tell the src that the server support code complete
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.']
      },
    }
  };
});

connection.onShutdown(() => {
  project.shutdown();
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
  let settings = change.settings as Settings;
  project.updateSettings(settings);
  // connection.console.log('Soliditytop binPath is: ' + project.settings.soliditytop.binPath);
  // Revalidate any open text documents
  // documents.all().forEach(validateTextDocument);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  // The pass parameter contains the position of the text document in 
  // which code complete got requested. For the example we ignore this
  // info and always provide the same completion items.
  try {
    // In SolidityProject.ts we also check for .
    // && projectParams.contentChanges[0].text.indexOf('(') < 0
    if ( projectParams !== null
      && projectParams.contentChanges[0].text !== '.') {

      const intelliSense:any[] = project.getIntelliSense(textDocumentPosition, projectParams);
      return intelliSense;
    } else {
      return [];
    }
  }  catch(err) {
    // console.log('onCompletion');
    console.log(err);
    return [];
  }
  // return [];
  /*
  return [
    {
      label: 'Test1',
      kind: CompletionItemKind.Snippet,
      data: 1
    },
    {
      label: 'Test2',
      kind: CompletionItemKind.Keyword,
      data: 2
    }
	];
  */
});

// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  /*
  item.detail = 'Word';
  if (item.data === 1) {
    item.detail = 'JavaScript details',
    item.documentation = 'solves by reflexivity';
  }
  */

  const intelliSense:string[] = project.settings.solidity.intelliSense;
  intelliSense.forEach((itemInS:any) => {
    if (item.kind === CompletionItemKind[itemInS.kind]) {
      item.detail = itemInS.label;
    }
  });

  // item.documentation = item.data;
  return item;
});

connection.onRequest(solidityproto.QuitSolidityRequest.type, (params: solidityproto.SolidityTopParams, token: CancellationToken) : Thenable<void> => {
  return project.lookup(params.uri)
    .quitSolidity();
});

// testRequest
connection.onRequest(solidityproto.testRequest.type, (params: solidityproto.SolidityTopParams, token: CancellationToken) => {
  return project.lookup(params.uri)
    .test(token);
});

connection.onCodeAction((params:CodeActionParams) => {
  return <Command[]>[];
});

connection.onCodeLens((params:CodeLensParams) => {
  return [];
});

connection.onCodeLensResolve((params:CodeLens) => {
  return params;
});

export interface DocumentLinkParams {
    // The document to provide document links for.
    textDocument: TextDocumentIdentifier;
}

connection.onDidOpenTextDocument((params: vscodeLangServer.DidOpenTextDocumentParams) => {
  // const uri = params.textDocument.uri;
  // connection.console.log(uri);

  project.open(params.textDocument, {
    sendMessage: (level:string, message: string, uri: string) => {
      const params : solidityproto.NotifyMessageParams =
      {
        level: level,
        message: message,
        uri: uri
      };
      connection.sendNotification(solidityproto.SolidityMessageNotification.type, params);},
  });
});

connection.onDidChangeTextDocument((params) => {
  try {
    projectParams = params;
    // connection.console.log(JSON.stringify(params));
    // [{"range":{"start":{"line":88,"character":0},"end":{"line":88,"character":1}},"rangeLength":1,"text":""}]

    return project.lookup(params.textDocument.uri)
      .applyTextEdits(params.contentChanges, params.textDocument.version);

  } catch(err) {
    connection.console.error(err.toString());
  }
});

connection.onDidCloseTextDocument((params) => {
  // A text document got closed in VSCode.
  // params.uri uniquely identifies the document.
  project.close(params.textDocument.uri);
});


// Listen on the connection
connection.listen();