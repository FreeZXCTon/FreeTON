'use strict';

import * as vscode from 'vscode';
import * as proto from './protocol';
import {SolidityDocument} from './SolidityDocument';
export {SolidityDocument} from './SolidityDocument';
import {SolidityLanguageServer} from './SolidityLanguageServer';
import * as editorAssist from './EditorAssist';

export function getProject() : SolidityProject {
  const solidity = SolidityProject.getInstance();
  if(!solidity) {
    throw 'SolidityProject not yet loaded';
  } else {
    return solidity;
  }
}

export class SolidityProject implements vscode.Disposable {
  private documents = new Map<string, SolidityDocument>();
  private activeEditor : vscode.TextEditor|undefined = undefined;
  private activeDoc : SolidityDocument|null = null;
  private static instance : SolidityProject|null = null;
  private langServer : SolidityLanguageServer;
  public currentSettings: proto.SoliditySettings;
  private subscriptions : vscode.Disposable[] = [];

  // lazily created output windows
  private solidityOutput: vscode.OutputChannel = vscode.window.createOutputChannel('Solidity');

  private constructor(context: vscode.ExtensionContext) {
    this.langServer = SolidityLanguageServer.create(context);

    this.activeEditor = vscode.window.activeTextEditor;

    this.loadConfiguration();
    this.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
      editorAssist.reload();
      this.loadConfiguration();
    }));


    vscode.workspace.onDidChangeTextDocument((params) => this.onDidChangeTextDocument(params));
    vscode.workspace.onDidOpenTextDocument((params) => this.onDidOpenTextDocument(params));
    vscode.workspace.onDidCloseTextDocument((params) => this.onDidCloseTextDocument(params));
    vscode.window.onDidChangeActiveTextEditor((params) => this.onDidChangeActiveTextEditor(params));
    // Handle already-loaded documents
    vscode.workspace.textDocuments
      .forEach((textDoc) => this.tryLoadDocument(textDoc));

  }

  private loadConfiguration() {
    let conf = vscode.workspace.getConfiguration('solidity') as vscode.WorkspaceConfiguration & proto.SoliditySettings;
    this.currentSettings = conf;
  }

  public static create(context: vscode.ExtensionContext) {
    if(!SolidityProject.instance) {
      SolidityProject.instance = new SolidityProject(context);
    }
    return SolidityProject.instance;
  }

  public static getInstance() {
    return SolidityProject.instance;
  }

  public get solidityOut(): vscode.OutputChannel {
    return this.solidityOutput;
  }

  dispose() {
    this.solidityOutput.dispose();
    this.documents.forEach((doc) => doc.dispose());
    this.subscriptions.forEach((s) => s.dispose());
    this.langServer.dispose();
    this.subscriptions = [];
    this.documents.clear();
  }

  public get(uri: string): SolidityDocument|null {
    return this.documents.get(uri) || null;
  }

  public getOrCurrent(uri: string): SolidityDocument|null {
    return this.documents.get(uri) || this.activeDoc;
  }

  public getLanguageServer() : SolidityLanguageServer {
    return this.langServer;
  }

  public get settings() : proto.SoliditySettings {
    return this.currentSettings;
  }

  private tryLoadDocument(textDoc: vscode.TextDocument) {
    if(textDoc.languageId !== 'solidity') {
      return;
    }
    const uri = textDoc.uri.toString();
    if(!this.documents.has(uri)) {
      this.documents.set(uri, new SolidityDocument(textDoc, this));
    }

    // refresh this in case the loaded document has focus and it was not in our registry
    if (vscode.window.activeTextEditor) {
      if(this.documents.has(vscode.window.activeTextEditor.document.uri.toString())) {
        this.activeDoc = this.documents.get(vscode.window.activeTextEditor.document.uri.toString()) || null;
      }
    }
  }

  private onDidChangeTextDocument(params: vscode.TextDocumentChangeEvent) {
    const uri = params.document.uri.toString();
    const doc = this.documents.get(uri);
    if(!doc) {
      return;
    }
    doc.onDidChangeTextDocument(params);
    // FOR DEBUGGING ONLY!!!
  }

  private onDidOpenTextDocument(doc: vscode.TextDocument) {
    this.tryLoadDocument(doc);
  }

  private onDidCloseTextDocument(doc: vscode.TextDocument) {
    const uri = doc.uri.toString();
    const solidityDoc = this.documents.get(uri);
    this.documents.delete(uri);
    if(!solidityDoc) {
      return;
    }
    solidityDoc.dispose();
  }

  public getActiveDoc() : SolidityDocument|null {
    return this.activeDoc;
  }

  public setActiveDoc(doc: vscode.Uri|string) : void {
    this.activeDoc = this.documents.get(doc.toString()) || null;
  }

  private onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
    if(!this.activeEditor) {
      return;
    }
    let oldUri : string|null;
    try {
      oldUri = this.activeEditor.document.uri.toString();
    } catch(err) {
      oldUri = null;
    }
    const oldDoc = oldUri ? this.documents.get(oldUri) : null;

    if(!editor) {
      if(oldDoc) {
        oldDoc.doOnLostFocus();
      }
      return;
    }

    if(oldDoc) {
      oldDoc.doOnLostFocus();
    }

    // newly active editor
    const uri = editor.document ? editor.document.uri.toString() : null;
    if(uri) {
      const doc = this.documents.get(uri) || this.tryLoadDocument(editor.document);
      if(doc) {
        this.activeDoc = doc;
        doc.doOnFocus(editor);
      }
    }

    this.activeEditor = editor;
  }

  private async tryDocumentCommand(command: (editor: vscode.TextEditor) => Promise<void>, useActive=true, makeVisible = true, ...args: any[]) {
    let editor : vscode.TextEditor|undefined = vscode.window.activeTextEditor;
    let doc : SolidityDocument | null;
    try {
      doc = editor ? this.documents.get(editor.document.uri.toString()) || null : null;
    } catch(err) {
      return;
    }

    if(!doc && useActive) {
      doc = this.activeDoc;
      editor = this.activeEditor;
    }

    if(doc) {
      let doc_ = doc; // TypeScript bug: does not realize the doc is not null in the next line, but this seems to work
      if(makeVisible && !vscode.window.visibleTextEditors.some((d) => d.document===doc_.getDocument())) {
        await vscode.window.showTextDocument(doc.getDocument(), undefined, true);
      }
      await command.call(doc,editor, ...args);
    }
  }

  public quitSolidity() {
    return this.tryDocumentCommand(SolidityDocument.prototype.quitSolidity,false,false);
  }

  public resetSolidity() {
    return this.tryDocumentCommand(SolidityDocument.prototype.resetSolidity,false,false);
  }

  // test
  public test() {
    // console.log('SolidityProject test');
    return this.tryDocumentCommand(SolidityDocument.prototype.test);
  }

  public setDisplayOption(item?: proto.DisplayOption, value?: proto.SetDisplayOption) {
    function setDisplayOption(this: SolidityDocument, editor: vscode.TextEditor) {
      return Promise.resolve(this.setDisplayOption(item, value));
    }
    return this.tryDocumentCommand(setDisplayOption,true,false);
  }
}