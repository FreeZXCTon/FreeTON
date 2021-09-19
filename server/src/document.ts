'use strict';

import { TextDocument, TextDocumentContentChangeEvent, RemoteConsole, Position, Range } from 'vscode-languageserver';
import { CancellationToken } from 'vscode-jsonrpc';
import * as thmProto from './protocol';
import * as textUtil from './util/text-util';
import { SolidityProject } from './SolidityProject';

/* vscode needs to export this class */
export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface MessageCallback {
  sendMessage(level: string, message: thmProto.AnnotatedText, uri: string) : void;
}
export interface ResetCallback {
  sendReset() : void;
}

export type DocumentCallbacks = MessageCallback;

export class SolidityDocument implements TextDocument {
  public languageId: string = 'solidity';
  public lineCount : number = 0;
  public uri: string;
  public version: number;
  private documentText: string;
  private documentRange: Range;

  public getText() {
    return this.documentText;
  }

  public getRange() : Range {
    return this.documentRange;
  }

  private project: SolidityProject;
  private clientConsole: RemoteConsole;
  private callbacks : MessageCallback;

  constructor(project: SolidityProject, document: TextDocumentItem, clientConsole: RemoteConsole, callbacks: DocumentCallbacks) {

    this.clientConsole = clientConsole;
    this.callbacks = callbacks;
    this.project = project;

    this.uri = document.uri;
    this.version = document.version;
    this.documentText = document.text;
    this.lineCount = textUtil.positionAt(document.text, document.text.length-1).line;

  }

  public async applyTextEdits(changes: TextDocumentContentChangeEvent[], newVersion: number) {
    // this.clientConsole.info('applyTextEdits');
    // let newRange = this.documentRange;
    // this.documentRange = newRange;
    this.documentRange = changes[0].range;

    if (this.documentRange !== undefined) {
      // this.clientConsole.info('documentRange');
      // this.clientConsole.info(JSON.stringify(this.documentRange));
    }
    // this.resetSolidity();
  }

  public contains(position: Position) : boolean {
    return textUtil.rangeContains(this.documentRange, position);
  }

  public offsetAt(pos: Position): number {
    // return this.document.offsetAt(pos);
    return textUtil.offsetAt(this.documentText, pos);
  }

  /*
   * @returns the Position (line, column) for the location (character position)
   */
  public positionAt(offset: number): Position {
    // return this.document.positionAt(offset);
    // Can't find the offset in a sentence, so calculate the position from the whole document
    return textUtil.positionAt(this.documentText, offset);
  }

  private onSolidityMessage(params: thmProto.NotifyMessageParams) { // (level: thmProto.MessageLevel, message: thmProto.AnnotatedText) {
    this.callbacks.sendMessage(params.level, params.message, params.uri);
  }

  public async resetSolidity() {
    // console.log('resetSolidity');
    this.onSolidityMessage({level: 'info', message: 'resetSolidity', uri: this.uri});
  }

  public async dispose() {
  }

  // private toGoal(goal: GoalResult) : thmProto.CommandResult {
  private toGoal(goal: any): thmProto.CommandResult {
    return goal;
  }

  // console
  private get console() { return this.project.console; }


  // test
  public async test(token: CancellationToken): Promise<thmProto.CommandResult> {

    try {
      this.console.log('document test log');
      this.clientConsole.info('TEST INFO in the document');

      let goal: any = { type: 'not-running' }; // not-running, interrupted, busy
      return this.toGoal(goal);

    } finally {
    }
  }

  public async quitSolidity() {
    if (!this.isStmRunning()) {
      return;
    }
  }

  public async setDisplayOptions(options: { item: thmProto.DisplayOption, value: thmProto.SetDisplayOption }[]) {
    if (!this.isStmRunning()) {
      return;
    }
  }

  public isStmRunning(): boolean {
    return true;
  }

}
