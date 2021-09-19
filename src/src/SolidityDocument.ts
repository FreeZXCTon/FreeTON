'use strict';

import * as vscode from 'vscode';
import { TextEditor } from 'vscode';
import * as vscodeTypes from 'vscode-languageserver-types';
import * as proto from './protocol';
import {SolidityDocumentLanguageServer} from './SolidityLanguageServer';
import {StatusBar} from './StatusBar';
import {SolidityProject} from './SolidityProject';
import * as psm from './prettify-symbols-mode';

namespace DisplayOptionPicks {
  type T = vscode.QuickPickItem & {displayItem: number};
  export const ImplicitArguments : T =
  { label: 'Implicit Arguments', description: 'toggle display of *implicit arguments*', detail: 'some detail', displayItem: proto.DisplayOption.ImplicitArguments };
  export const Coercions : T =
  { label: 'Coercions', description: 'toggle display of *coercions*', displayItem: proto.DisplayOption.Coercions };
  export const RawMatchingExpressions : T =
  { label: 'Raw Matching Expressions', description: 'toggle display of *raw matching expressions*', displayItem: proto.DisplayOption.RawMatchingExpressions };
  export const Notations : T =
  { label: 'Notations', description: 'toggle display of notations', displayItem: proto.DisplayOption.Notations };
  export const AllBasicLowLevelContents : T =
  { label: 'All Basic Low Level Contents', description: 'toggle display of ', displayItem: proto.DisplayOption.AllBasicLowLevelContents };
  export const ExistentialVariableInstances : T =
  { label: 'Existential Variable Instances', description: 'toggle display of ', displayItem: proto.DisplayOption.ExistentialVariableInstances };
  export const UniverseLevels : T =
  { label: 'Universe Levels', description: 'toggle display of ', displayItem: proto.DisplayOption.UniverseLevels };
  export const AllLowLevelContents : T =
  { label: 'All Low Level Contents', description: 'toggle display of ', displayItem: proto.DisplayOption.AllLowLevelContents };
  export const allPicks = [ImplicitArguments, Coercions, RawMatchingExpressions, Notations, AllBasicLowLevelContents, ExistentialVariableInstances, UniverseLevels, AllLowLevelContents];
}

export class SolidityDocument implements vscode.Disposable {
  private statusBar: StatusBar;
  public documentUri: string;
  private document: vscode.TextDocument;
  private langServer: SolidityDocumentLanguageServer;

  private focus?: vscode.Position;
  private project: SolidityProject;

  constructor(document: vscode.TextDocument, project: SolidityProject) {
    this.statusBar = new StatusBar();
    this.document = document;
    this.project = project;
    // this.document = vscode.workspace.textDocuments.find((doc) => doc.uri === uri);

    this.documentUri = document.uri.toString();
    try {
      this.langServer = new SolidityDocumentLanguageServer(document.uri.toString());
    }  catch(err) {
    let x = this.langServer;
    x = x;
    }

    this.langServer.onMessage((p) => this.onSolidityMessage(p));
    this.langServer.onReset((p) => this.onSolidityReset());

    /*
    if(vscode.window.activeTextEditor)
      if(vscode.window.activeTextEditor.document.uri.toString() == this.documentUri)
        this.statusBar.focus();
    this.statusBar.setStateReady();
    */
  }

  public getUri() {
    return this.documentUri;
  }

  public getDocument() {
    return this.document;
  }

  public dispose() {
    this.langServer.dispose();
  }

  private reset() {

  }

  private onSolidityMessage(params: proto.NotifyMessageParams) {
    // this.project.solidityOut.clear();
    this.project.solidityOut.show(true);
    this.project.solidityOut.appendLine(psm.prettyTextToString(params.level  + ': ' + params.message + ', uri = ' + params.uri));
  }

  public onDidChangeTextDocument(params: vscode.TextDocumentChangeEvent) {
    this.updateFocus(this.focus, false);
  }

  public async quitSolidity(editor?: TextEditor) {
    this.statusBar.setStateMessage('Killing SolidityTop');
    try {
      await this.langServer.quitSolidity();
    } finally {}
    this.reset();
    this.statusBar.setStateReady();
  }


  public async resetSolidity(editor?: TextEditor) {
    this.statusBar.setStateMessage('Resetting Solidity');
    try {
      await this.langServer.resetSolidity();
    } finally {}
    this.reset();
    this.statusBar.setStateReady();
  }

  public allEditors() : vscode.TextEditor[] {
    return vscode.window.visibleTextEditors.filter((editor,i,a) =>
      editor.document.uri.toString() === this.documentUri);
  }

  private onSolidityReset() {
    this.reset();
    this.statusBar.setStateReady();
  }

  private updateFocus(focus?: vscodeTypes.Position, moveCursor = false) {
    if(focus) {
      this.focus = new vscode.Position(focus.line,focus.character);
    } else {
    }
  }

  private handleResult(value: proto.CommandResult) {
    // console.log('handleResult ' + value.type);

    if(value.type === 'busy') {
      return false;
    }

    else if(value.type === 'not-running') {
    } else if(value.type === 'interrupted') {
      this.statusBar.setStateComputing(proto.ComputingStatus.Interrupted);
    }
    else {

    }
    return true;
  }

  private showFocusDecorations() {
    if(!this.focus) {
      return;
    }
  }

  private async makePreviewOpenedFilePermanent(editor: TextEditor){
     // Make sure that the file is really open instead of preview-open, to avoid accidentaly closing the file
    await vscode.commands.executeCommand('workbench.action.keepEditor',editor.document.uri);
  }

  // test
  public async test(editor: TextEditor) {
    console.log('SolidityDocument test');
    this.statusBar.setStateWorking('test');
    try {
      this.makePreviewOpenedFilePermanent(editor);
      const value = await this.langServer.test();
      this.handleResult(value);
    } catch (err) {
    }
    this.statusBar.setStateReady();
    this.onSolidityMessage({level: 'info', message: psm.prettyTextToString('Test'), uri: this.documentUri});
  }

  public async doOnLostFocus() {
    this.statusBar.unfocus();
  }

  public async doOnFocus(editor: TextEditor) {
    this.showFocusDecorations();
    this.statusBar.focus();
  }

  private async queryDisplayOptionChange() : Promise<proto.DisplayOption|null> {
      const result = await vscode.window.showQuickPick(DisplayOptionPicks.allPicks);
      if (result) {
        return result.displayItem;
      }
      else {
        return null;
      }
  }

  public async setDisplayOption(item?: proto.DisplayOption, value?: proto.SetDisplayOption) {
    if(item===undefined) {
      item = await this.queryDisplayOptionChange() || undefined;
      if(!item) {
        return;
      }
    }
    value = value || proto.SetDisplayOption.Toggle;
    try {
      await this.langServer.setDisplayOptions([{item: item, value: value}]);
    } catch(err) { }
 }

 public getCurrentFocus() {
   return this.focus;
 }

}
