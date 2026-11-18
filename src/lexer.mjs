import { isIdentifierStart, isIdentifierPart } from './identifier-profile.mjs';
import { RCLSyntaxError } from './errors.mjs';

// Raw source coordinates are tooling metadata, outside serialized token values.
const tokenSourceRanges = new WeakMap();
export function getTokenSourceRange(token) { return tokenSourceRanges.get(token) ?? null; }

const TWO_CHAR = new Set(['<-', '->', '==', '!=', '<=', '>=']);
const ONE_CHAR = new Set(['{', '}', '(', ')', ':', ',', '.', '=', '+', '-', '*', '/', '%', '<', '>']);

function isDigit(ch) { return ch >= '0' && ch <= '9'; }
const isIdStart = isIdentifierStart;
const isIdPart = isIdentifierPart;

export function lexReality(source, { sourceRanges = false } = {}) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const push = (type, value, startLine, startColumn, startOffset) => {
    const token = { type, value, line: startLine, column: startColumn };
    if (sourceRanges) tokenSourceRanges.set(token, Object.freeze({
      start: Object.freeze({ line: startLine - 1, character: startColumn - 1 }),
      end: Object.freeze({ line: line - 1, character: column - 1 }),
      offset: startOffset,
      length: i - startOffset,
    }));
    tokens.push(token);
  };

  const advance = () => {
    const ch = source[i++];
    if (ch === '\n') { line += 1; column = 1; }
    else column += 1;
    return ch;
  };

  while (i < source.length) {
    const ch = source[i];

    if (/\s/u.test(ch)) { advance(); continue; }

    if (ch === '#' || (ch === '/' && source[i + 1] === '/')) {
      while (i < source.length && source[i] !== '\n') advance();
      continue;
    }

    const startOffset = i;
    const startLine = line;
    const startColumn = column;

    if (ch === '"') {
      let raw = '';
      advance();
      let closed = false;
      while (i < source.length) {
        const current = advance();
        if (current === '"') { closed = true; break; }
        if (current === '\\') {
          if (i >= source.length) break;
          const escaped = advance();
          const map = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
          raw += map[escaped] ?? escaped;
        } else raw += current;
      }
      if (!closed) throw new RCLSyntaxError('Unterminated text literal', { line: startLine, column: startColumn, value: raw });
      push('STRING', raw, startLine, startColumn, startOffset);
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1]))) {
      let raw = '';
      let dots = 0;
      while (i < source.length && (isDigit(source[i]) || source[i] === '.')) {
        if (source[i] === '.') dots += 1;
        if (dots > 1) break;
        raw += advance();
      }
      if (source[i] === 'e' || source[i] === 'E') {
        const sign = source[i + 1] === '+' || source[i + 1] === '-';
        if (isDigit(source[i + (sign ? 2 : 1)])) {
          raw += advance();
          if (sign) raw += advance();
          while (isDigit(source[i])) raw += advance();
        }
      }
      if (!Number.isFinite(Number(raw))) {
        throw new RCLSyntaxError('Number literal must be finite', { line: startLine, column: startColumn, value: raw });
      }
      push('NUMBER', raw, startLine, startColumn, startOffset);
      continue;
    }

    if (isIdStart(ch)) {
      let raw = '';
      while (i < source.length && isIdPart(source[i])) raw += advance();
      push('IDENT', raw, startLine, startColumn, startOffset);
      continue;
    }

    const pair = source.slice(i, i + 2);
    if (TWO_CHAR.has(pair)) {
      advance(); advance();
      push('SYMBOL', pair, startLine, startColumn, startOffset);
      continue;
    }

    if (ONE_CHAR.has(ch)) {
      advance();
      push('SYMBOL', ch, startLine, startColumn, startOffset);
      continue;
    }

    throw new RCLSyntaxError(`Unexpected character ${JSON.stringify(ch)}`, { line: startLine, column: startColumn, value: ch });
  }

  push('EOF', '<eof>', line, column, i);
  return tokens;
}
