'use strict';
import {Position, Range} from 'vscode-languageserver';

// 'sticky' flag is not yet supported :()
const lineEndingRE = /([^\r\n]*)(\r\n|\r|\n)?/;

export interface RangeDelta {
  start: Position;
  end: Position;
  linesDelta: number;
  charactersDelta: number; // delta for positions on the same line as the end position
}

export function positionIsEqual(pos1: Position, pos2: Position) : boolean {
  return pos1.line===pos2.line && pos1.character === pos2.character;
}

export function positionIsBefore(pos1: Position, pos2: Position) : boolean {
  return (pos1.line < pos2.line || (pos1.line===pos2.line && pos1.character < pos2.character));
}

export function positionIsBeforeOrEqual(pos1: Position, pos2: Position) : boolean {
  return (pos1.line < pos2.line || (pos1.line===pos2.line && pos1.character <= pos2.character));
}

export function positionIsAfter(pos1: Position, pos2: Position) : boolean {
  return (pos1.line > pos2.line || (pos1.line===pos2.line && pos1.character > pos2.character));
}

export function positionIsAfterOrEqual(pos1: Position, pos2: Position) : boolean {
  return (pos1.line > pos2.line || (pos1.line===pos2.line && pos1.character >= pos2.character));
}

export function rangeContains(range: Range, pos: Position) : boolean {
  return !positionIsBefore(pos,range.start) && positionIsBefore(pos,range.end);
}

export function rangeContainsOrTouches(range: Range, pos: Position) : boolean {
  return !positionIsBeforeOrEqual(pos,range.start) && positionIsBeforeOrEqual(pos,range.end);
}

export function rangeIntersects(range1: Range, range2: Range) : boolean {
  return rangeContains(range1,range2.start) || rangeContains(range1,range2.end);
}

export function rangeTouches(range1: Range, range2: Range) : boolean {
  return rangeContainsOrTouches(range1,range2.start) || rangeContainsOrTouches(range1,range2.end);
}

export function rangeToString(r: Range) {
  return `${r.start.line}:${r.start.character}-${r.end.line}:${r.end.character}`;
}

/* Calculates the offset into text of pos, where textStart is the position where text starts and both pos and textStart are absolute positions 
 * @return the offset into text indicated by pos, or -1 if pos is out of range
 *
 * 'abc\ndef'
 * 'acbX\ndef'
 * +++*** --> +++_***
 * */
export function relativeOffsetAtAbsolutePosition(text: string, textStart: Position, pos: Position) : number {
  let line = textStart.line;
  let currentOffset = 0;
  // count the relative lines and offset w.r.t text
  while(line < pos.line) {
    const match = lineEndingRE.exec(text.substring(currentOffset));
    ++line;   // there was a new line
    currentOffset += match[0].length;
  }

  if(line > pos.line) {
    return -1
  }
  else if(textStart.line === pos.line) {
    return Math.max(-1, pos.character - textStart.character);
 }
  else { // if(line === pos.line)
    return Math.max(-1, pos.character + currentOffset);
 }
}

export function offsetAt(text: string, pos: Position) : number {
  let line = pos.line;
  let lastIndex = 0;
  while (line > 0) {
    const match = lineEndingRE.exec(text.substring(lastIndex));
    if(match[2] === '' || match[2] === undefined) { // no line-ending found
      return -1;
    } // the position is beyond the length of text
    else {
      lastIndex+= match[0].length;
      --line;
    }
  }
  return lastIndex + pos.character;
}

/**
 * @returns the Position (line, column) for the location (character position), assuming that text begins at start
 */
export function positionAtRelative(start: Position, text: string, offset: number) : Position {
  if(offset > text.length) {
    offset = text.length;
  }
  let line = start.line;
  let currentOffset = 0;  // offset into text we are current at; <= `offset`
  let lineOffset = start.character;
  while(true) {
    const match = lineEndingRE.exec(text.substring(currentOffset));
    // match[0] -- characters plus newline
    // match[1] -- characters up to newline
    // match[2] -- newline (\n, \r, or \r\n)
    if(!match || match[0].length === 0 || currentOffset + match[1].length >= offset) {
      return Position.create(line, lineOffset + Math.max(offset - currentOffset, 0))
    }
    currentOffset+= match[0].length;
    lineOffset = 0;
    ++line;
  }
}

/**
 * @returns the Position (line, column) for the location (character position), assuming that text begins at start.
 *
 * @param offset -- counts all newlines (e.g. '\r\n') as *one character* 
 */
export function positionAtRelativeCNL(start: Position, text: string, offset: number) : Position {
  if(offset > text.length) {
    return positionAtRelative(start, text, text.length);
  }
  let line = start.line;
  let currentOffset = 0;  // offset into text we are current at; <= `offset`
  let lineOffset = start.character;
  while(true) {
    const match = lineEndingRE.exec(text.substring(currentOffset));
    // match[0] -- characters plus newline
    // match[1] -- characters up to newline
    // match[2] -- newline (\n, \r, or \r\n)
    if(!match || match[0].length === 0 || match[1].length >= offset) {
      return Position.create(line, lineOffset + offset)
    }
    currentOffset+= match[0].length;
    offset -= match[1].length + (match[2]===undefined ? 0 : 1);
    lineOffset = 0;
    ++line;
  }
}

/**
 * @returns the Position (line, column) for the location (character position)
 */
export function positionAt(text: string, offset: number) : Position {
  if(offset > text.length) {
    offset = text.length;
  }
  let line = 0;
  let lastIndex = 0;
  while(true) {
    const match = lineEndingRE.exec(text.substring(lastIndex));
    if(lastIndex + match[1].length >= offset) {
      return Position.create(line, Math.max(offset - lastIndex,0))
    }
    lastIndex+= match[0].length;
    ++line;
  }
}

/**
 * @returns the lines and characters represented by the text
 */
export function toRangeDelta(oldRange:Range, text: string) : RangeDelta {
  const newEnd = positionAt(text,text.length);
  let charsDelta;
  if(oldRange.start.line === oldRange.end.line) {
    charsDelta = newEnd.character - (oldRange.end.character-oldRange.start.character);
  }
  else {
    charsDelta = newEnd.character - oldRange.end.character;
  }

  return {
    start: oldRange.start,
    end: oldRange.end,
    linesDelta: newEnd.line-(oldRange.end.line-oldRange.start.line),
    charactersDelta: charsDelta
  };
}

export function positionRangeDeltaTranslate(pos: Position, delta: RangeDelta) : Position {
  if(positionIsBefore(pos,delta.end)) {
    return pos;
  }
  else if (delta.end.line === pos.line) {
    let x = pos.character + delta.charactersDelta;
    if (delta.linesDelta > 0) {
      x = x - delta.end.character;
    }
    else if (delta.start.line === delta.end.line + delta.linesDelta && delta.linesDelta < 0) { 
      x = x + delta.start.character;
 }
    return Position.create(pos.line + delta.linesDelta, x);
  }
  else { // if(pos.line > delta.end.line)
    return Position.create(pos.line + delta.linesDelta, pos.character);
 }
}

export function positionRangeDeltaTranslateEnd(pos: Position, delta: RangeDelta) : Position {
  if(positionIsBeforeOrEqual(pos,delta.start)) {
    return pos;
  }
  else {
    // Calculate the shifted position
    let result : Position;
    if (delta.end.line === pos.line) {
      let x = pos.character + delta.charactersDelta;
      if (delta.linesDelta > 0) { 
        x = x - delta.end.character;
      }
      else if (delta.start.line === delta.end.line + delta.linesDelta && delta.linesDelta < 0) { 
        x = x + delta.start.character;
      }
      result = Position.create(pos.line + delta.linesDelta, x);
    } else { // if(pos.line > delta.end.line)
      result = Position.create(pos.line + delta.linesDelta, pos.character);
    }
    // But do not move above that delta's start position
    if(positionIsBefore(result,delta.start)) {
      return delta.start;
    }
    else {
      return result;
    }
  }
}

export function rangeDeltaTranslate(range: Range, delta: RangeDelta) {
  return Range.create(
    positionRangeDeltaTranslate(range.start, delta),
    positionRangeDeltaTranslateEnd(range.end, delta)
  );
}

/* Sums the two positions. In effect, gets the absolute position of `relPos`.
 * @param absPos -- position at which `relPos` is relative to
 * @param relPos -- a relative position
 */
export function positionTranslateRelative(absPos: Position, relPos: Position) {
  if(relPos.line === 0) {
    return Position.create(absPos.line, absPos.character+relPos.character);
  }
  else {
    return Position.create(absPos.line+relPos.line, relPos.character);
  }
}

/* Converts `relRange` from a relative range w.r.t. `absPos` to an absolute range.
 * @param absPos -- position at which `relRange` is relative to
 * @param relRange -- a range, relative to absPos
 */
export function rangeTranslateRelative(absPos: Position, relRange: Range) {
  return Range.create(positionTranslateRelative(absPos, relRange.start), positionTranslateRelative(absPos, relRange.end))
}
