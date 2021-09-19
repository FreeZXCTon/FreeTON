'use strict';
import { RequestType, NotificationType } from 'vscode-jsonrpc';
import * as vscode from 'vscode-languageserver-types';

export interface DocumentFilter {
  language?: string,
  pattern?: string,
  scheme?: string,
}
export type DocumentSelector = string | DocumentFilter | (string | DocumentFilter)[];

/** The substitution settings for a language (or group of languages) */
export interface LanguageEntry {
  /** language(s) to apply these substitutions on */
  language:  DocumentSelector;
  /** substitution rules */
  substitutions: Substitution[];
}

export interface PrettifySymbolsModeSettings {
  substitutions: LanguageEntry[];
}

// The settings interface describe the server relevant settings part
export interface Settings {
  soliditytop: SolidityTopSettings,
  solidity: SoliditySettings,
  prettifySymbolsMode?: PrettifySymbolsModeSettings,
}

export interface SolidityTopSettings {
  binPath: string;
  /** A list of arguments to send to solidityqtop. @default `[]` */
  args: string[];
  /** When should an instance of soliditytop be started for a Solidity script */
  startOn: 'open-script' | 'interaction',
}

export interface AutoFormattingSettings {
  enable: boolean, // mast switch
  indentAfterBullet: 'none' | 'indent' | 'align',
  indentAfterOpenProof: boolean,
  unindentOnCloseProof: boolean,
}

export interface SoliditySettings {
  format: any,
  intelliSense: [],
  loadSolidityProject: boolean,
  solidityProjectRoot: string,
}

export enum SetDisplayOption {
  On, Off, Toggle
}

export enum DisplayOption {
  ImplicitArguments,
  Coercions,
  RawMatchingExpressions,
  Notations,
  AllBasicLowLevelContents,
  ExistentialVariableInstances,
  UniverseLevels,
  AllLowLevelContents,
}

export interface SolidityTopParams {
  uri: string;
}

export interface Substitution {
  ugly: string;        // regular expression describing the text to replace
  pretty: string;      // plain-text symbol to show instead
  pre?: string;        // regular expression guard on text before "ugly"
  post?: string;       // regular expression guard on text after "ugly"
  style?: any;         // stylings to apply to the "pretty" text, if specified, or else the ugly text
}


export type TextDifference = 'added'|'removed';

export interface TextAnnotation {
  diff?: TextDifference,
  substitution?: string,
  text: string
}

export interface ScopedText {
  scope: string,
  attributes?: any,
  text: AnnotatedText,
}

export type AnnotatedText = string | TextAnnotation | ScopedText | (string | TextAnnotation | ScopedText)[];

export interface CommandInterrupted {
  range: vscode.Range;
}

export type FocusPosition = {focus: vscode.Position};
export type NotRunningTag = {type: 'not-running'};
export type InterruptedTag = {type: 'interrupted'};
export type BusyTag = {type: 'busy'};
export type NotRunningResult = NotRunningTag & {reason: 'not-started'|'spawn-failed', soliditytop?: string};
export type BusyResult = BusyTag;
export type InterruptedResult = CommandInterrupted & InterruptedTag;
export type CommandResult =
  NotRunningResult |
  (BusyResult & FocusPosition) |
  (InterruptedResult & FocusPosition);

export namespace QuitSolidityRequest {
  export const type = new RequestType<SolidityTopParams, void, void, void>('soliditytop/quitSolidity');
}


export namespace ResetSolidityRequest {
  export const type = new RequestType<SolidityTopParams, void, void, void>('soliditytop/resetSolidity');
}

// testRequest
export namespace testRequest {
  export const type = new RequestType<SolidityTopParams, CommandResult, void, void>('soliditytop/test');
}

export interface SolidityTopSetDisplayOptionsParams extends SolidityTopParams {
  options: {item: DisplayOption, value: SetDisplayOption}[];
}

export namespace SetDisplayOptionsRequest {
  export const type = new RequestType<SolidityTopSetDisplayOptionsParams, void, void, void>('soliditytop/setDisplayOptions');
}

export interface NotificationParams {
  uri: string;
}

export interface Highlights {
  ranges: [vscode.Range[],vscode.Range[],vscode.Range[],vscode.Range[],vscode.Range[],vscode.Range[]];
}

export type NotifyHighlightParams = NotificationParams & Highlights;

export interface NotifyMessageParams extends NotificationParams {
  level: string;
  message: AnnotatedText;
  // routeId: Number;
}

export namespace SolidityMessageNotification {
  export const type = new NotificationType<NotifyMessageParams,void>('soliditytop/message');
}

export interface DocumentPositionParams extends NotificationParams {
  position: vscode.Position;
}

export enum ComputingStatus {Finished, Computing, Interrupted}
