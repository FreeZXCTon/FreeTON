'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import * as proto from './protocol';

import { workspace, ExtensionContext } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';
import * as vscodeClient from 'vscode-languageclient';

function createServerLocalExtension(serverModule: string, debugOptions: string[]): ServerOptions {
  const options: { run: vscodeClient.NodeModule; debug: vscodeClient.NodeModule } = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: debugOptions } }
  };
  return options;
}

export class SolidityLanguageServer implements vscode.Disposable {
  private static instance: SolidityLanguageServer;
  private subscriptions: vscode.Disposable[] = [];
  private server: LanguageClient;
  private cancelRequest = new vscode.CancellationTokenSource();
  private documentCallbacks = new Map<string,DocumentCallbacks>();

  private constructor(context: ExtensionContext) {
    // The server is implemented in node
    let serverModule = context.asAbsolutePath(path.join('out', 'server', 'src', 'server.js'));
    // The debug options for the server
    let debugOptions = ['--nolazy', '--inspect=6009'];

    // let serverOptions = createServerProcess(serverModule, debugOptions);
    let serverOptions = createServerLocalExtension(serverModule, debugOptions);

    // Options to control the language src
    let clientOptions: LanguageClientOptions = {
      // Register the server for Solidity scripts
      documentSelector: ['solidity'],
      synchronize: {
        // Synchronize the setting section 'languageServerExample' to the server
        configurationSection: ['soliditytop', 'solidity', 'prettifySymbolsMode'],
        // Notify the server about file changes to '.clientrc files contain in the workspace
        fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
      }
    };

    // Create the language src and start the src.
    this.server = new LanguageClient('Solidity Language Server', serverOptions, clientOptions);
    this.server.onReady()
      .then(() => {

        this.server.onNotification(proto.SolidityMessageNotification.type, (p) => {
          const doc = this.documentCallbacks.get(p.uri);
          if(doc) {
            doc.onMessage.forEach((l) => l(p));
          }
        });

        console.log('Solidity language server ready');
      }, (reason) =>
        console.log('Solidity language server failed to load: ' + reason.toString()));

    this.subscriptions.push(this.server.start());
  }

  public static create(context: ExtensionContext): SolidityLanguageServer {
    if (!SolidityLanguageServer.instance) {
      SolidityLanguageServer.instance = new SolidityLanguageServer(context);
    }
    return SolidityLanguageServer.instance;
  }

  public static getInstance(): SolidityLanguageServer {
    return this.instance;
  }

  public dispose() {
    this.server.stop();
    this.subscriptions.forEach((d) => d.dispose());
    this.cancelRequest.dispose();
    this.subscriptions = [];
    this.documentCallbacks.clear();
  }

  public registerDocument(uri: string, doc: DocumentCallbacks) {
    if(this.documentCallbacks.has(uri)) {
      throw 'Duplicate Solidity document being registered.';
    }
    this.documentCallbacks.set(uri, doc);
  }

  public unregisterDocument(uri: string) {
    this.documentCallbacks.delete(uri);
  }

  public async quitSolidity(uri: string) {
    await this.server.onReady();
    return await this.server.sendRequest(proto.QuitSolidityRequest.type, { uri: uri });
  }

  public async resetSolidity(uri: string) {
    await this.server.onReady();
    return await this.server.sendRequest(proto.ResetSolidityRequest.type, { uri: uri });
  }

  // test
  public async test(uri: string): Promise<proto.CommandResult> {
    await this.server.onReady();
    // console.log('SolidityLanguageServer test');
    return this.server.sendRequest(proto.testRequest.type, { uri: uri }, this.cancelRequest.token);
  }

  public async setDisplayOptions(uri: string, options: { item: proto.DisplayOption, value: proto.SetDisplayOption }[]): Promise<void> {
    await this.server.onReady();
    return this.server.sendRequest(proto.SetDisplayOptionsRequest.type, <proto.SolidityTopSetDisplayOptionsParams>{
      uri: uri,
      options: options
    }, this.cancelRequest.token);
  }
}


interface DocumentCallbacks {
  onMessage: ((params: proto.NotifyMessageParams) => void)[],
  onReset: ((params: proto.NotificationParams) => void)[],
}

function removeFromArray<T>(arr: T[], item: T) {
  const idx = arr.findIndex((x) => x===item);
  if(idx >= 0) {
    arr.splice(idx,1);
  }
}

function registerCallback<T>(arr: T[], listener: T) : vscode.Disposable {
  arr.push(listener);
  return { dispose: () => removeFromArray(arr, listener) };
}

export class SolidityDocumentLanguageServer implements vscode.Disposable {
  private server = SolidityLanguageServer.getInstance();
  private callbacks : DocumentCallbacks = {
    onMessage: [],
    onReset: [],
  };

  public constructor(
    private uri: string
  ) {
    this.server.registerDocument(this.uri, this.callbacks);
  }

  public dispose() {
    this.callbacks = {
      onMessage: [],
      onReset: [],
    };
    this.server.unregisterDocument(this.uri);
  }

  public onMessage(listener: (params: proto.NotifyMessageParams) => void) {
    return registerCallback(this.callbacks.onMessage, listener);
  }

  public onReset(listener: (params: proto.NotificationParams) => void) {
    return registerCallback(this.callbacks.onReset, listener);
  }

  public quitSolidity() {
    return this.server.quitSolidity(this.uri);
  }

  public resetSolidity() {
    return this.server.resetSolidity(this.uri);
  }

  public test(): Thenable<proto.CommandResult> {
    return this.server.test(this.uri);
  }

  public setDisplayOptions(options: { item: proto.DisplayOption, value: proto.SetDisplayOption }[]): Thenable<void> {
    return this.server.setDisplayOptions(this.uri, options);
  }

}
