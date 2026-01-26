/**
 * TeeemXL Formula Engine
 *
 * A comprehensive Excel-compatible formula parser and evaluator.
 * Supports:
 * - Cell references (A1, $A$1, $A1, A$1)
 * - Range references (A1:B10)
 * - Arithmetic operators (+, -, *, /, ^, %)
 * - Comparison operators (=, <>, <, >, <=, >=)
 * - Text concatenation (&)
 * - Functions (SUM, IF, VLOOKUP, etc.)
 * - Nested formulas
 * - Error handling (#REF!, #VALUE!, #DIV/0!, #NAME?, #N/A, #NUM!)
 * - Circular reference detection
 */

export type CellValue = string | number | boolean | null;
export type ErrorValue = '#REF!' | '#VALUE!' | '#DIV/0!' | '#NAME?' | '#N/A' | '#NUM!' | '#ERROR!' | '#CIRCULAR!';

export interface CellData {
  value: CellValue | ErrorValue;
  formula?: string;
  type?: 'string' | 'number' | 'boolean' | 'formula' | 'error';
  format?: CellFormat;
}

export interface CellFormat {
  type: 'general' | 'number' | 'currency' | 'percentage' | 'date' | 'text';
  decimals?: number;
  currency?: string;
  dateFormat?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export type CellGetter = (ref: string) => CellData | undefined;

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN TYPES
// ═══════════════════════════════════════════════════════════════════════════

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'CELL_REF'
  | 'RANGE'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'ERROR';

interface Token {
  type: TokenType;
  value: string | number | boolean;
  raw: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEXER
// ═══════════════════════════════════════════════════════════════════════════

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = formula.length;

  while (i < len) {
    const char = formula[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Numbers (including decimals and scientific notation)
    if (/[\d.]/.test(char)) {
      let num = '';
      while (i < len && /[\d.eE+-]/.test(formula[i])) {
        // Handle scientific notation properly
        if ((formula[i] === '+' || formula[i] === '-') &&
            num.length > 0 &&
            !/[eE]$/.test(num)) {
          break;
        }
        num += formula[i];
        i++;
      }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) {
        tokens.push({ type: 'ERROR', value: '#NUM!', raw: num });
      } else {
        tokens.push({ type: 'NUMBER', value: parsed, raw: num });
      }
      continue;
    }

    // String literals
    if (char === '"') {
      let str = '';
      i++; // Skip opening quote
      while (i < len && formula[i] !== '"') {
        // Handle escaped quotes
        if (formula[i] === '\\' && formula[i + 1] === '"') {
          str += '"';
          i += 2;
        } else if (formula[i] === '"' && formula[i + 1] === '"') {
          // Excel-style escaped quotes
          str += '"';
          i += 2;
        } else {
          str += formula[i];
          i++;
        }
      }
      i++; // Skip closing quote
      tokens.push({ type: 'STRING', value: str, raw: `"${str}"` });
      continue;
    }

    // Operators
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '^' || char === '%' || char === '&') {
      tokens.push({ type: 'OPERATOR', value: char, raw: char });
      i++;
      continue;
    }

    // Comparison operators
    if (char === '=' || char === '<' || char === '>') {
      let op = char;
      if (formula[i + 1] === '=' || (char === '<' && formula[i + 1] === '>')) {
        op += formula[i + 1];
        i++;
      }
      tokens.push({ type: 'OPERATOR', value: op, raw: op });
      i++;
      continue;
    }

    // Parentheses and comma
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(', raw: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')', raw: ')' });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'COMMA', value: ',', raw: ',' });
      i++;
      continue;
    }
    if (char === ':') {
      tokens.push({ type: 'COLON', value: ':', raw: ':' });
      i++;
      continue;
    }

    // Identifiers (functions, cell references, booleans)
    if (/[A-Za-z$_]/.test(char)) {
      let ident = '';
      while (i < len && /[A-Za-z0-9$_]/.test(formula[i])) {
        ident += formula[i];
        i++;
      }

      const upper = ident.toUpperCase();

      // Check for boolean
      if (upper === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true, raw: ident });
        continue;
      }
      if (upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false, raw: ident });
        continue;
      }

      // Check if it's a function (followed by opening paren)
      if (formula[i] === '(') {
        tokens.push({ type: 'FUNCTION', value: upper, raw: ident });
        continue;
      }

      // Cell reference (including absolute references like $A$1)
      if (/^\$?[A-Z]+\$?\d+$/i.test(ident)) {
        tokens.push({ type: 'CELL_REF', value: upper.replace(/\$/g, ''), raw: ident });
        continue;
      }

      // Named range or unknown - treat as cell reference for now
      tokens.push({ type: 'CELL_REF', value: upper, raw: ident });
      continue;
    }

    // Unknown character - skip
    i++;
  }

  return tokens;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSER & EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════

class FormulaParser {
  private tokens: Token[] = [];
  private pos = 0;
  private getCell: CellGetter;
  private visitedCells: Set<string>;

  constructor(getCell: CellGetter, visitedCells: Set<string> = new Set()) {
    this.getCell = getCell;
    this.visitedCells = visitedCells;
  }

  parse(formula: string): CellValue | ErrorValue {
    // Remove leading = if present
    if (formula.startsWith('=')) {
      formula = formula.substring(1);
    }

    this.tokens = tokenize(formula);
    this.pos = 0;

    if (this.tokens.length === 0) {
      return null;
    }

    try {
      const result = this.parseExpression();
      return result;
    } catch (error) {
      if (error instanceof FormulaError) {
        return error.code;
      }
      return '#ERROR!';
    }
  }

  private peek(): Token | null {
    return this.tokens[this.pos] || null;
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private parseExpression(): CellValue | ErrorValue {
    return this.parseComparison();
  }

  private parseComparison(): CellValue | ErrorValue {
    let left = this.parseConcatenation();

    while (this.peek()?.type === 'OPERATOR' &&
           ['=', '<>', '<', '>', '<=', '>='].includes(String(this.peek()?.value))) {
      const op = this.consume().value as string;
      const right = this.parseConcatenation();

      if (isError(left)) return left;
      if (isError(right)) return right;

      left = this.applyComparison(op, left, right);
    }

    return left;
  }

  private parseConcatenation(): CellValue | ErrorValue {
    let left = this.parseAddition();

    while (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '&') {
      this.consume();
      const right = this.parseAddition();

      if (isError(left)) return left;
      if (isError(right)) return right;

      left = String(left ?? '') + String(right ?? '');
    }

    return left;
  }

  private parseAddition(): CellValue | ErrorValue {
    let left = this.parseMultiplication();

    while (this.peek()?.type === 'OPERATOR' &&
           (this.peek()?.value === '+' || this.peek()?.value === '-')) {
      const op = this.consume().value as string;
      const right = this.parseMultiplication();

      if (isError(left)) return left;
      if (isError(right)) return right;

      const leftNum = toNumber(left);
      const rightNum = toNumber(right);

      if (leftNum === null || rightNum === null) {
        return '#VALUE!';
      }

      left = op === '+' ? leftNum + rightNum : leftNum - rightNum;
    }

    return left;
  }

  private parseMultiplication(): CellValue | ErrorValue {
    let left = this.parsePower();

    while (this.peek()?.type === 'OPERATOR' &&
           (this.peek()?.value === '*' || this.peek()?.value === '/')) {
      const op = this.consume().value as string;
      const right = this.parsePower();

      if (isError(left)) return left;
      if (isError(right)) return right;

      const leftNum = toNumber(left);
      const rightNum = toNumber(right);

      if (leftNum === null || rightNum === null) {
        return '#VALUE!';
      }

      if (op === '/' && rightNum === 0) {
        return '#DIV/0!';
      }

      left = op === '*' ? leftNum * rightNum : leftNum / rightNum;
    }

    return left;
  }

  private parsePower(): CellValue | ErrorValue {
    let left = this.parseUnary();

    while (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '^') {
      this.consume();
      const right = this.parseUnary();

      if (isError(left)) return left;
      if (isError(right)) return right;

      const leftNum = toNumber(left);
      const rightNum = toNumber(right);

      if (leftNum === null || rightNum === null) {
        return '#VALUE!';
      }

      left = Math.pow(leftNum, rightNum);
    }

    return left;
  }

  private parseUnary(): CellValue | ErrorValue {
    if (this.peek()?.type === 'OPERATOR') {
      const op = this.peek()?.value;
      if (op === '-' || op === '+') {
        this.consume();
        const operand = this.parseUnary();

        if (isError(operand)) return operand;

        const num = toNumber(operand);
        if (num === null) return '#VALUE!';

        return op === '-' ? -num : num;
      }
    }

    return this.parsePostfix();
  }

  private parsePostfix(): CellValue | ErrorValue {
    let value = this.parsePrimary();

    // Handle percentage
    if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '%') {
      this.consume();
      if (isError(value)) return value;
      const num = toNumber(value);
      if (num === null) return '#VALUE!';
      return num / 100;
    }

    return value;
  }

  private parsePrimary(): CellValue | ErrorValue {
    const token = this.peek();

    if (!token) {
      return null;
    }

    switch (token.type) {
      case 'NUMBER':
        this.consume();
        return token.value as number;

      case 'STRING':
        this.consume();
        return token.value as string;

      case 'BOOLEAN':
        this.consume();
        return token.value as boolean;

      case 'ERROR':
        this.consume();
        return token.value as ErrorValue;

      case 'CELL_REF':
        return this.parseCellOrRange();

      case 'FUNCTION':
        return this.parseFunction();

      case 'LPAREN':
        this.consume();
        const expr = this.parseExpression();
        if (this.peek()?.type === 'RPAREN') {
          this.consume();
        }
        return expr;

      default:
        this.consume();
        return '#VALUE!';
    }
  }

  private parseCellOrRange(): CellValue | ErrorValue {
    const startToken = this.consume();
    const startRef = String(startToken.value);

    // Check if this is a range (A1:B10)
    if (this.peek()?.type === 'COLON') {
      this.consume(); // consume :
      const endToken = this.consume();
      if (endToken?.type !== 'CELL_REF') {
        return '#REF!';
      }
      const endRef = String(endToken.value);

      // Return range as array (for use in functions)
      return this.getRangeValues(startRef, endRef) as unknown as CellValue;
    }

    // Single cell reference
    return this.getCellValue(startRef);
  }

  private getCellValue(ref: string): CellValue | ErrorValue {
    const normalizedRef = ref.toUpperCase().replace(/\$/g, '');

    // Check for circular reference
    if (this.visitedCells.has(normalizedRef)) {
      return '#CIRCULAR!';
    }

    const cell = this.getCell(normalizedRef);
    if (!cell) {
      return null; // Empty cell
    }

    // If cell has a formula, evaluate it (recursively)
    if (cell.formula) {
      const newVisited = new Set(this.visitedCells);
      newVisited.add(normalizedRef);
      const parser = new FormulaParser(this.getCell, newVisited);
      return parser.parse(cell.formula);
    }

    return cell.value;
  }

  private getRangeValues(startRef: string, endRef: string): (CellValue | ErrorValue)[] {
    const start = parseRef(startRef);
    const end = parseRef(endRef);

    if (!start || !end) {
      return ['#REF!' as ErrorValue];
    }

    const values: (CellValue | ErrorValue)[] = [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const ref = getCellRef(r, c);
        values.push(this.getCellValue(ref));
      }
    }

    return values;
  }

  private parseFunction(): CellValue | ErrorValue {
    const funcToken = this.consume();
    const funcName = String(funcToken.value);

    // Consume opening paren
    if (this.peek()?.type !== 'LPAREN') {
      return '#NAME?';
    }
    this.consume();

    // Parse arguments
    const args: (CellValue | ErrorValue | (CellValue | ErrorValue)[])[] = [];

    if (this.peek()?.type !== 'RPAREN') {
      // First argument
      args.push(this.parseArgument());

      // Additional arguments
      while (this.peek()?.type === 'COMMA') {
        this.consume();
        args.push(this.parseArgument());
      }
    }

    // Consume closing paren
    if (this.peek()?.type === 'RPAREN') {
      this.consume();
    }

    return this.evaluateFunction(funcName, args);
  }

  private parseArgument(): CellValue | ErrorValue | (CellValue | ErrorValue)[] {
    const token = this.peek();

    // Check if this is a range (for functions that accept ranges)
    if (token?.type === 'CELL_REF') {
      const startRef = this.consume().value as string;

      if (this.peek()?.type === 'COLON') {
        this.consume();
        const endToken = this.consume();
        if (endToken?.type === 'CELL_REF') {
          return this.getRangeValues(startRef, endToken.value as string);
        }
      }

      // Single cell reference
      return this.getCellValue(startRef);
    }

    return this.parseExpression();
  }

  private evaluateFunction(
    name: string,
    args: (CellValue | ErrorValue | (CellValue | ErrorValue)[])[]
  ): CellValue | ErrorValue {
    const func = FUNCTIONS[name];
    if (!func) {
      return '#NAME?';
    }

    try {
      return func(args, this.getCell, this.visitedCells);
    } catch (error) {
      if (error instanceof FormulaError) {
        return error.code;
      }
      return '#ERROR!';
    }
  }

  private applyComparison(
    op: string,
    left: CellValue | ErrorValue,
    right: CellValue | ErrorValue
  ): boolean {
    // Convert to comparable values
    const leftVal = left ?? '';
    const rightVal = right ?? '';

    // Number comparison
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);

    if (leftNum !== null && rightNum !== null) {
      switch (op) {
        case '=': return leftNum === rightNum;
        case '<>': return leftNum !== rightNum;
        case '<': return leftNum < rightNum;
        case '>': return leftNum > rightNum;
        case '<=': return leftNum <= rightNum;
        case '>=': return leftNum >= rightNum;
      }
    }

    // String comparison (case-insensitive like Excel)
    const leftStr = String(leftVal).toLowerCase();
    const rightStr = String(rightVal).toLowerCase();

    switch (op) {
      case '=': return leftStr === rightStr;
      case '<>': return leftStr !== rightStr;
      case '<': return leftStr < rightStr;
      case '>': return leftStr > rightStr;
      case '<=': return leftStr <= rightStr;
      case '>=': return leftStr >= rightStr;
    }

    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

class FormulaError extends Error {
  code: ErrorValue;

  constructor(code: ErrorValue) {
    super(code);
    this.code = code;
    this.name = 'FormulaError';
  }
}

function isError(value: unknown): value is ErrorValue {
  if (typeof value !== 'string') return false;
  return ['#REF!', '#VALUE!', '#DIV/0!', '#NAME?', '#N/A', '#NUM!', '#ERROR!', '#CIRCULAR!'].includes(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function toNumber(value: CellValue | ErrorValue): number | null {
  if (value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    if (isError(value)) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  return null;
}

function toString(value: CellValue | ErrorValue): string {
  if (value === null) return '';
  return String(value);
}

function toBoolean(value: CellValue | ErrorValue): boolean {
  if (value === null || value === '' || value === 0) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toUpperCase() === 'FALSE') return false;
    if (value.toUpperCase() === 'TRUE') return true;
  }
  return Boolean(value);
}

function flattenArgs(args: (CellValue | ErrorValue | (CellValue | ErrorValue)[])[]): (CellValue | ErrorValue)[] {
  const result: (CellValue | ErrorValue)[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...arg);
    } else {
      result.push(arg);
    }
  }
  return result;
}

function getNumbers(args: (CellValue | ErrorValue | (CellValue | ErrorValue)[])[]): number[] {
  const flat = flattenArgs(args);
  const numbers: number[] = [];
  for (const val of flat) {
    if (isError(val)) continue;
    const num = toNumber(val);
    if (num !== null && !isNaN(num)) {
      numbers.push(num);
    }
  }
  return numbers;
}

// Cell reference helpers
function parseRef(ref: string): { row: number; col: number } | null {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    col: colLetterToIndex(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

function getCellRef(row: number, col: number): string {
  return `${getColumnLetter(col)}${row + 1}`;
}

function colLetterToIndex(col: string): number {
  let result = 0;
  for (const char of col.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

function getColumnLetter(index: number): string {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULA FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

type FormulaFunction = (
  args: (CellValue | ErrorValue | (CellValue | ErrorValue)[])[],
  getCell: CellGetter,
  visitedCells: Set<string>
) => CellValue | ErrorValue;

const FUNCTIONS: Record<string, FormulaFunction> = {
  // ─────────────────────────────────────────────────────────────────────────
  // MATH & AGGREGATE FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  SUM: (args) => {
    const numbers = getNumbers(args);
    return numbers.reduce((sum, n) => sum + n, 0);
  },

  SUMIF: (args) => {
    if (args.length < 2) return '#VALUE!';
    const range = args[0];
    const criteria = args[1];
    const sumRange = args[2] || range;

    if (!Array.isArray(range)) return '#VALUE!';
    const sumValues = Array.isArray(sumRange) ? sumRange : range;

    let total = 0;
    for (let i = 0; i < range.length; i++) {
      if (matchesCriteria(range[i], criteria)) {
        const val = toNumber(sumValues[i]);
        if (val !== null) total += val;
      }
    }
    return total;
  },

  SUMIFS: (args) => {
    if (args.length < 3 || args.length % 2 === 0) return '#VALUE!';
    const sumRange = args[0];
    if (!Array.isArray(sumRange)) return '#VALUE!';

    let total = 0;
    for (let i = 0; i < sumRange.length; i++) {
      let matches = true;

      // Check all criteria pairs
      for (let j = 1; j < args.length; j += 2) {
        const criteriaRange = args[j];
        const criteria = args[j + 1];

        if (!Array.isArray(criteriaRange)) {
          matches = false;
          break;
        }

        if (!matchesCriteria(criteriaRange[i], criteria)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        const val = toNumber(sumRange[i]);
        if (val !== null) total += val;
      }
    }
    return total;
  },

  AVERAGE: (args) => {
    const numbers = getNumbers(args);
    if (numbers.length === 0) return '#DIV/0!';
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  },

  AVERAGEIF: (args) => {
    if (args.length < 2) return '#VALUE!';
    const range = args[0];
    const criteria = args[1];
    const avgRange = args[2] || range;

    if (!Array.isArray(range)) return '#VALUE!';
    const avgValues = Array.isArray(avgRange) ? avgRange : range;

    const matching: number[] = [];
    for (let i = 0; i < range.length; i++) {
      if (matchesCriteria(range[i], criteria)) {
        const val = toNumber(avgValues[i]);
        if (val !== null) matching.push(val);
      }
    }

    if (matching.length === 0) return '#DIV/0!';
    return matching.reduce((sum, n) => sum + n, 0) / matching.length;
  },

  COUNT: (args) => {
    const flat = flattenArgs(args);
    return flat.filter(v => {
      if (v === null || v === '') return false;
      const num = toNumber(v);
      return num !== null && !isNaN(num);
    }).length;
  },

  COUNTA: (args) => {
    const flat = flattenArgs(args);
    return flat.filter(v => v !== null && v !== '').length;
  },

  COUNTBLANK: (args) => {
    const flat = flattenArgs(args);
    return flat.filter(v => v === null || v === '').length;
  },

  COUNTIF: (args) => {
    if (args.length < 2) return '#VALUE!';
    const range = args[0];
    const criteria = args[1];

    if (!Array.isArray(range)) return '#VALUE!';

    return range.filter(v => matchesCriteria(v, criteria)).length;
  },

  COUNTIFS: (args) => {
    if (args.length < 2 || args.length % 2 !== 0) return '#VALUE!';

    const firstRange = args[0];
    if (!Array.isArray(firstRange)) return '#VALUE!';

    let count = 0;
    for (let i = 0; i < firstRange.length; i++) {
      let matches = true;

      for (let j = 0; j < args.length; j += 2) {
        const criteriaRange = args[j];
        const criteria = args[j + 1];

        if (!Array.isArray(criteriaRange)) {
          matches = false;
          break;
        }

        if (!matchesCriteria(criteriaRange[i], criteria)) {
          matches = false;
          break;
        }
      }

      if (matches) count++;
    }
    return count;
  },

  MIN: (args) => {
    const numbers = getNumbers(args);
    if (numbers.length === 0) return 0;
    return Math.min(...numbers);
  },

  MAX: (args) => {
    const numbers = getNumbers(args);
    if (numbers.length === 0) return 0;
    return Math.max(...numbers);
  },

  ROUND: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const decimals = toNumber(flat[1]) ?? 0;
    if (num === null) return '#VALUE!';
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  ROUNDUP: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const decimals = toNumber(flat[1]) ?? 0;
    if (num === null) return '#VALUE!';
    const factor = Math.pow(10, decimals);
    return Math.ceil(num * factor) / factor;
  },

  ROUNDDOWN: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const decimals = toNumber(flat[1]) ?? 0;
    if (num === null) return '#VALUE!';
    const factor = Math.pow(10, decimals);
    return Math.floor(num * factor) / factor;
  },

  ABS: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    if (num === null) return '#VALUE!';
    return Math.abs(num);
  },

  SQRT: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    if (num === null) return '#VALUE!';
    if (num < 0) return '#NUM!';
    return Math.sqrt(num);
  },

  POWER: (args) => {
    const flat = flattenArgs(args);
    const base = toNumber(flat[0]);
    const exp = toNumber(flat[1]);
    if (base === null || exp === null) return '#VALUE!';
    return Math.pow(base, exp);
  },

  MOD: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const divisor = toNumber(flat[1]);
    if (num === null || divisor === null) return '#VALUE!';
    if (divisor === 0) return '#DIV/0!';
    return num % divisor;
  },

  INT: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    if (num === null) return '#VALUE!';
    return Math.floor(num);
  },

  CEILING: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const sig = toNumber(flat[1]) ?? 1;
    if (num === null) return '#VALUE!';
    if (sig === 0) return 0;
    return Math.ceil(num / sig) * sig;
  },

  FLOOR: (args) => {
    const flat = flattenArgs(args);
    const num = toNumber(flat[0]);
    const sig = toNumber(flat[1]) ?? 1;
    if (num === null) return '#VALUE!';
    if (sig === 0) return 0;
    return Math.floor(num / sig) * sig;
  },

  RAND: () => Math.random(),

  RANDBETWEEN: (args) => {
    const flat = flattenArgs(args);
    const min = toNumber(flat[0]);
    const max = toNumber(flat[1]);
    if (min === null || max === null) return '#VALUE!';
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOGICAL FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  IF: (args) => {
    const flat = flattenArgs(args);
    const condition = toBoolean(flat[0]);
    const trueValue = flat[1] ?? true;
    const falseValue = flat[2] ?? false;
    return condition ? trueValue : falseValue;
  },

  IFS: (args) => {
    const flat = flattenArgs(args);
    for (let i = 0; i < flat.length; i += 2) {
      if (toBoolean(flat[i])) {
        return flat[i + 1] ?? null;
      }
    }
    return '#N/A';
  },

  IFERROR: (args) => {
    const flat = flattenArgs(args);
    const value = flat[0];
    const errorValue = flat[1] ?? '';
    if (isError(value)) return errorValue;
    return value;
  },

  IFNA: (args) => {
    const flat = flattenArgs(args);
    const value = flat[0];
    const naValue = flat[1] ?? '';
    if (value === '#N/A') return naValue;
    return value;
  },

  AND: (args) => {
    const flat = flattenArgs(args);
    if (flat.length === 0) return '#VALUE!';
    for (const val of flat) {
      if (isError(val)) return val;
      if (!toBoolean(val)) return false;
    }
    return true;
  },

  OR: (args) => {
    const flat = flattenArgs(args);
    if (flat.length === 0) return '#VALUE!';
    for (const val of flat) {
      if (isError(val)) return val;
      if (toBoolean(val)) return true;
    }
    return false;
  },

  NOT: (args) => {
    const flat = flattenArgs(args);
    return !toBoolean(flat[0]);
  },

  XOR: (args) => {
    const flat = flattenArgs(args);
    let count = 0;
    for (const val of flat) {
      if (toBoolean(val)) count++;
    }
    return count % 2 === 1;
  },

  TRUE: () => true,
  FALSE: () => false,

  // ─────────────────────────────────────────────────────────────────────────
  // TEXT FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  CONCATENATE: (args) => {
    const flat = flattenArgs(args);
    return flat.map(v => toString(v)).join('');
  },

  CONCAT: (args) => {
    const flat = flattenArgs(args);
    return flat.map(v => toString(v)).join('');
  },

  TEXTJOIN: (args) => {
    const flat = flattenArgs(args);
    if (flat.length < 2) return '#VALUE!';
    const delimiter = toString(flat[0]);
    const ignoreEmpty = toBoolean(flat[1]);
    const values = flat.slice(2).map(v => toString(v));
    const filtered = ignoreEmpty ? values.filter(v => v !== '') : values;
    return filtered.join(delimiter);
  },

  LEN: (args) => {
    const flat = flattenArgs(args);
    return toString(flat[0]).length;
  },

  LEFT: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const count = toNumber(flat[1]) ?? 1;
    if (count < 0) return '#VALUE!';
    return text.substring(0, count);
  },

  RIGHT: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const count = toNumber(flat[1]) ?? 1;
    if (count < 0) return '#VALUE!';
    return text.substring(text.length - count);
  },

  MID: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const start = toNumber(flat[1]);
    const count = toNumber(flat[2]);
    if (start === null || count === null) return '#VALUE!';
    if (start < 1 || count < 0) return '#VALUE!';
    return text.substring(start - 1, start - 1 + count);
  },

  UPPER: (args) => {
    const flat = flattenArgs(args);
    return toString(flat[0]).toUpperCase();
  },

  LOWER: (args) => {
    const flat = flattenArgs(args);
    return toString(flat[0]).toLowerCase();
  },

  PROPER: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    return text.replace(/\b\w/g, c => c.toUpperCase());
  },

  TRIM: (args) => {
    const flat = flattenArgs(args);
    return toString(flat[0]).replace(/\s+/g, ' ').trim();
  },

  CLEAN: (args) => {
    const flat = flattenArgs(args);
    return toString(flat[0]).replace(/[\x00-\x1F]/g, '');
  },

  SUBSTITUTE: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const oldText = toString(flat[1]);
    const newText = toString(flat[2]);
    const instance = toNumber(flat[3]);

    if (oldText === '') return text;

    if (instance !== null && instance > 0) {
      let count = 0;
      return text.replace(new RegExp(escapeRegExp(oldText), 'g'), (match) => {
        count++;
        return count === instance ? newText : match;
      });
    }

    return text.split(oldText).join(newText);
  },

  REPLACE: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const start = toNumber(flat[1]);
    const count = toNumber(flat[2]);
    const newText = toString(flat[3]);

    if (start === null || count === null) return '#VALUE!';
    if (start < 1) return '#VALUE!';

    return text.substring(0, start - 1) + newText + text.substring(start - 1 + count);
  },

  FIND: (args) => {
    const flat = flattenArgs(args);
    const findText = toString(flat[0]);
    const withinText = toString(flat[1]);
    const startNum = toNumber(flat[2]) ?? 1;

    if (startNum < 1) return '#VALUE!';

    const index = withinText.indexOf(findText, startNum - 1);
    return index === -1 ? '#VALUE!' : index + 1;
  },

  SEARCH: (args) => {
    const flat = flattenArgs(args);
    const findText = toString(flat[0]).toLowerCase();
    const withinText = toString(flat[1]).toLowerCase();
    const startNum = toNumber(flat[2]) ?? 1;

    if (startNum < 1) return '#VALUE!';

    const index = withinText.indexOf(findText, startNum - 1);
    return index === -1 ? '#VALUE!' : index + 1;
  },

  REPT: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]);
    const times = toNumber(flat[1]);
    if (times === null || times < 0) return '#VALUE!';
    return text.repeat(times);
  },

  TEXT: (args) => {
    const flat = flattenArgs(args);
    const value = flat[0];
    const format = toString(flat[1]);

    const num = toNumber(value);
    if (num === null) return toString(value);

    // Basic number formatting
    if (format.includes('#') || format.includes('0')) {
      const decimals = (format.match(/\.(0+|#+)/)?.[1]?.length) ?? 0;
      let formatted = num.toFixed(decimals);

      if (format.includes(',')) {
        const parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formatted = parts.join('.');
      }

      if (format.startsWith('$')) {
        formatted = '$' + formatted;
      }

      if (format.endsWith('%')) {
        formatted = (num * 100).toFixed(decimals) + '%';
      }

      return formatted;
    }

    return String(num);
  },

  VALUE: (args) => {
    const flat = flattenArgs(args);
    const text = toString(flat[0]).replace(/[$,]/g, '');
    const num = parseFloat(text);
    return isNaN(num) ? '#VALUE!' : num;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUP & REFERENCE FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  VLOOKUP: (args) => {
    const flat = flattenArgs(args);
    const lookupValue = flat[0];
    const tableArray = args[1]; // Keep as array
    const colIndex = toNumber(flat[2]);
    const rangeLookup = flat[3] !== false && flat[3] !== 0;

    if (!Array.isArray(tableArray) || colIndex === null) return '#VALUE!';
    if (colIndex < 1) return '#VALUE!';

    const rows = tableArray.length;

    if (rangeLookup) {
      let bestIndex = -1;
      for (let i = 0; i < rows; i++) {
        const cellVal = tableArray[i];
        const cmp = compareValues(cellVal, lookupValue);
        if (cmp <= 0) {
          if (bestIndex === -1 || compareValues(cellVal, tableArray[bestIndex]) > 0) {
            bestIndex = i;
          }
        }
      }
      if (bestIndex === -1) return '#N/A';
      return tableArray[bestIndex];
    } else {
      for (let i = 0; i < rows; i++) {
        if (compareValues(tableArray[i], lookupValue) === 0) {
          return tableArray[i];
        }
      }
      return '#N/A';
    }
  },

  HLOOKUP: (args) => {
    const flat = flattenArgs(args);
    const lookupValue = flat[0];
    const tableArray = args[1];
    const rowIndex = toNumber(flat[2]);
    const rangeLookup = flat[3] !== false && flat[3] !== 0;

    if (!Array.isArray(tableArray) || rowIndex === null) return '#VALUE!';
    if (rowIndex < 1) return '#VALUE!';

    if (!rangeLookup) {
      for (let i = 0; i < tableArray.length; i++) {
        if (compareValues(tableArray[i], lookupValue) === 0) {
          return tableArray[i];
        }
      }
    }
    return '#N/A';
  },

  INDEX: (args) => {
    const array = args[0];
    const flat = flattenArgs(args.slice(1));
    const rowNum = toNumber(flat[0]);

    if (!Array.isArray(array)) return '#VALUE!';
    if (rowNum === null || rowNum < 1) return '#VALUE!';

    const index = (rowNum - 1);
    if (index >= array.length) return '#REF!';

    return array[index];
  },

  MATCH: (args) => {
    const flat = flattenArgs(args);
    const lookupValue = flat[0];
    const lookupArray = args[1];
    const matchType = toNumber(flat[2]) ?? 1;

    if (!Array.isArray(lookupArray)) return '#VALUE!';

    if (matchType === 0) {
      for (let i = 0; i < lookupArray.length; i++) {
        if (compareValues(lookupArray[i], lookupValue) === 0) {
          return i + 1;
        }
      }
      return '#N/A';
    } else if (matchType === 1) {
      let bestIndex = -1;
      for (let i = 0; i < lookupArray.length; i++) {
        if (compareValues(lookupArray[i], lookupValue) <= 0) {
          bestIndex = i;
        } else {
          break;
        }
      }
      return bestIndex === -1 ? '#N/A' : bestIndex + 1;
    } else {
      for (let i = 0; i < lookupArray.length; i++) {
        if (compareValues(lookupArray[i], lookupValue) <= 0) {
          return i + 1;
        }
      }
      return '#N/A';
    }
  },

  CHOOSE: (args) => {
    const flat = flattenArgs(args);
    const index = toNumber(flat[0]);
    if (index === null || index < 1 || index > flat.length - 1) return '#VALUE!';
    return flat[index];
  },

  ROW: (args) => {
    if (args.length === 0) return 1;
    const cellRef = args[0];
    if (typeof cellRef === 'string') {
      const parsed = parseRef(cellRef);
      return parsed ? parsed.row + 1 : '#REF!';
    }
    return 1;
  },

  COLUMN: (args) => {
    if (args.length === 0) return 1;
    const cellRef = args[0];
    if (typeof cellRef === 'string') {
      const parsed = parseRef(cellRef);
      return parsed ? parsed.col + 1 : '#REF!';
    }
    return 1;
  },

  ROWS: (args) => {
    const range = args[0];
    if (!Array.isArray(range)) return 1;
    return range.length;
  },

  COLUMNS: () => {
    return 1;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DATE & TIME FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  TODAY: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  NOW: () => {
    return new Date().toISOString();
  },

  DATE: (args) => {
    const flat = flattenArgs(args);
    const year = toNumber(flat[0]);
    const month = toNumber(flat[1]);
    const day = toNumber(flat[2]);

    if (year === null || month === null || day === null) return '#VALUE!';

    const d = new Date(year, month - 1, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  YEAR: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getFullYear();
  },

  MONTH: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getMonth() + 1;
  },

  DAY: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getDate();
  },

  HOUR: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getHours();
  },

  MINUTE: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getMinutes();
  },

  SECOND: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '#VALUE!' : d.getSeconds();
  },

  WEEKDAY: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const returnType = toNumber(flat[1]) ?? 1;
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return '#VALUE!';

    const day = d.getDay();
    if (returnType === 1) return day + 1;
    if (returnType === 2) return day === 0 ? 7 : day;
    if (returnType === 3) return day === 0 ? 6 : day - 1;
    return day + 1;
  },

  EOMONTH: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const months = toNumber(flat[1]) ?? 0;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '#VALUE!';

    d.setMonth(d.getMonth() + months + 1);
    d.setDate(0);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  EDATE: (args) => {
    const flat = flattenArgs(args);
    const dateStr = toString(flat[0]);
    const months = toNumber(flat[1]) ?? 0;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '#VALUE!';

    d.setMonth(d.getMonth() + months);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  DATEDIF: (args) => {
    const flat = flattenArgs(args);
    const startDate = new Date(toString(flat[0]));
    const endDate = new Date(toString(flat[1]));
    const unit = toString(flat[2]).toUpperCase();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '#VALUE!';

    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    switch (unit) {
      case 'D': return diffDays;
      case 'M': return (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                       (endDate.getMonth() - startDate.getMonth());
      case 'Y': return endDate.getFullYear() - startDate.getFullYear();
      default: return '#VALUE!';
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INFORMATION FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  ISBLANK: (args) => {
    const flat = flattenArgs(args);
    return flat[0] === null || flat[0] === '';
  },

  ISERROR: (args) => {
    const flat = flattenArgs(args);
    return isError(flat[0]);
  },

  ISNA: (args) => {
    const flat = flattenArgs(args);
    return flat[0] === '#N/A';
  },

  ISNUMBER: (args) => {
    const flat = flattenArgs(args);
    return typeof flat[0] === 'number';
  },

  ISTEXT: (args) => {
    const flat = flattenArgs(args);
    return typeof flat[0] === 'string' && !isError(flat[0]);
  },

  ISLOGICAL: (args) => {
    const flat = flattenArgs(args);
    return typeof flat[0] === 'boolean';
  },

  N: (args) => {
    const flat = flattenArgs(args);
    const val = flat[0];
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return 0;
  },

  NA: () => '#N/A',

  TYPE: (args) => {
    const flat = flattenArgs(args);
    const val = flat[0];
    if (typeof val === 'number') return 1;
    if (typeof val === 'string') return isError(val) ? 16 : 2;
    if (typeof val === 'boolean') return 4;
    if (Array.isArray(val)) return 64;
    return 1;
  },
};

// Helper to match criteria (for SUMIF, COUNTIF, etc.)
function matchesCriteria(
  value: CellValue | ErrorValue,
  criteria: CellValue | ErrorValue | (CellValue | ErrorValue)[]
): boolean {
  if (Array.isArray(criteria)) {
    criteria = criteria[0];
  }

  if (criteria === null || criteria === '') return value === null || value === '';

  const criteriaStr = toString(criteria);

  // Check for comparison operators
  if (criteriaStr.startsWith('>=')) {
    const num = parseFloat(criteriaStr.substring(2));
    const valNum = toNumber(value);
    return valNum !== null && valNum >= num;
  }
  if (criteriaStr.startsWith('<=')) {
    const num = parseFloat(criteriaStr.substring(2));
    const valNum = toNumber(value);
    return valNum !== null && valNum <= num;
  }
  if (criteriaStr.startsWith('<>')) {
    const target = criteriaStr.substring(2);
    const num = parseFloat(target);
    if (!isNaN(num)) {
      return toNumber(value) !== num;
    }
    return toString(value).toLowerCase() !== target.toLowerCase();
  }
  if (criteriaStr.startsWith('>')) {
    const num = parseFloat(criteriaStr.substring(1));
    const valNum = toNumber(value);
    return valNum !== null && valNum > num;
  }
  if (criteriaStr.startsWith('<')) {
    const num = parseFloat(criteriaStr.substring(1));
    const valNum = toNumber(value);
    return valNum !== null && valNum < num;
  }
  if (criteriaStr.startsWith('=')) {
    const target = criteriaStr.substring(1);
    const num = parseFloat(target);
    if (!isNaN(num)) {
      return toNumber(value) === num;
    }
    return toString(value).toLowerCase() === target.toLowerCase();
  }

  // Wildcard matching (* and ?)
  if (criteriaStr.includes('*') || criteriaStr.includes('?')) {
    const regex = new RegExp(
      '^' + criteriaStr
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.') + '$',
      'i'
    );
    return regex.test(toString(value));
  }

  // Exact match
  const num = parseFloat(criteriaStr);
  if (!isNaN(num)) {
    return toNumber(value) === num;
  }

  return toString(value).toLowerCase() === criteriaStr.toLowerCase();
}

function compareValues(a: CellValue | ErrorValue, b: CellValue | ErrorValue): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  const aNum = toNumber(a);
  const bNum = toNumber(b);

  if (aNum !== null && bNum !== null) {
    return aNum - bNum;
  }

  const aStr = toString(a).toLowerCase();
  const bStr = toString(b).toLowerCase();

  return aStr.localeCompare(bStr);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULA EVALUATION & DEPENDENCY TRACKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract all cell references from a formula
 */
export function extractReferences(formula: string): string[] {
  if (!formula.startsWith('=')) return [];

  const refs: string[] = [];
  const regex = /\$?([A-Z]+)\$?(\d+)/gi;
  let match;

  while ((match = regex.exec(formula)) !== null) {
    refs.push(`${match[1].toUpperCase()}${match[2]}`);
  }

  // Also extract ranges
  const rangeRegex = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/gi;
  formula.replace(rangeRegex, (_, startCol, startRow, endCol, endRow) => {
    const startColIdx = colLetterToIndex(startCol);
    const endColIdx = colLetterToIndex(endCol);
    const startRowIdx = parseInt(startRow) - 1;
    const endRowIdx = parseInt(endRow) - 1;

    for (let r = Math.min(startRowIdx, endRowIdx); r <= Math.max(startRowIdx, endRowIdx); r++) {
      for (let c = Math.min(startColIdx, endColIdx); c <= Math.max(startColIdx, endColIdx); c++) {
        refs.push(getCellRef(r, c));
      }
    }
    return '';
  });

  return [...new Set(refs)];
}

/**
 * Extract references with color group indices
 * Single cell refs get their own group, ranges share a group
 * Returns a map of cell ref -> color index (0, 1, 2, etc.)
 */
export function extractReferencesWithColors(formula: string): Map<string, number> {
  if (!formula.startsWith('=')) return new Map();

  const refColors = new Map<string, number>();
  let colorIndex = 0;

  // First, find all ranges and assign them the same color
  const rangeRegex = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/gi;
  const rangeMatches: { start: number; end: number; cells: string[] }[] = [];

  let match;
  while ((match = rangeRegex.exec(formula)) !== null) {
    const startCol = match[1].toUpperCase();
    const startRow = match[2];
    const endCol = match[3].toUpperCase();
    const endRow = match[4];

    const startColIdx = colLetterToIndex(startCol);
    const endColIdx = colLetterToIndex(endCol);
    const startRowIdx = parseInt(startRow) - 1;
    const endRowIdx = parseInt(endRow) - 1;

    const cells: string[] = [];
    for (let r = Math.min(startRowIdx, endRowIdx); r <= Math.max(startRowIdx, endRowIdx); r++) {
      for (let c = Math.min(startColIdx, endColIdx); c <= Math.max(startColIdx, endColIdx); c++) {
        cells.push(getCellRef(r, c));
      }
    }

    rangeMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      cells,
    });
  }

  // Assign colors to ranges first
  for (const range of rangeMatches) {
    for (const cell of range.cells) {
      if (!refColors.has(cell)) {
        refColors.set(cell, colorIndex);
      }
    }
    colorIndex++;
  }

  // Now find single cell references (not part of a range)
  const singleRefRegex = /\$?([A-Z]+)\$?(\d+)/gi;
  while ((match = singleRefRegex.exec(formula)) !== null) {
    // Check if this match is part of a range
    const isPartOfRange = rangeMatches.some(
      (range) => match!.index >= range.start && match!.index < range.end
    );

    if (!isPartOfRange) {
      const cellRef = `${match[1].toUpperCase()}${match[2]}`;
      if (!refColors.has(cellRef)) {
        refColors.set(cellRef, colorIndex);
        colorIndex++;
      }
    }
  }

  return refColors;
}

/**
 * Adjust formula references when copying/pasting
 * Handles absolute ($A$1), mixed ($A1, A$1), and relative (A1) references
 */
export function adjustFormula(
  formula: string,
  rowOffset: number,
  colOffset: number
): string {
  return formula.replace(
    /(\$?)([A-Z]+)(\$?)(\d+)/gi,
    (match, colLock, col, rowLock, row) => {
      let newCol = col.toUpperCase();
      let newRow = parseInt(row);

      // Only adjust if not locked
      if (!colLock) {
        const colIdx = colLetterToIndex(col) + colOffset;
        if (colIdx < 0) return match;
        newCol = getColumnLetter(colIdx);
      }

      if (!rowLock) {
        newRow = parseInt(row) + rowOffset;
        if (newRow < 1) return match;
      }

      return `${colLock}${newCol}${rowLock}${newRow}`;
    }
  );
}

/**
 * Main formula evaluation function
 */
export function evaluateFormula(
  formula: string,
  getCell: CellGetter
): CellValue | ErrorValue {
  const parser = new FormulaParser(getCell);
  return parser.parse(formula);
}

/**
 * Build dependency graph for recalculation
 */
export function buildDependencyGraph(
  cells: Map<string, CellData>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const [ref, cell] of cells) {
    if (cell.formula) {
      const deps = extractReferences(cell.formula);
      for (const dep of deps) {
        if (!graph.has(dep)) {
          graph.set(dep, new Set());
        }
        graph.get(dep)!.add(ref);
      }
    }
  }

  return graph;
}

/**
 * Get cells that need recalculation in topological order
 */
export function getCellsToRecalculate(
  changedCells: string[],
  dependencyGraph: Map<string, Set<string>>
): string[] {
  const toRecalc = new Set<string>();
  const queue = [...changedCells];

  while (queue.length > 0) {
    const ref = queue.shift()!;
    const dependents = dependencyGraph.get(ref);
    if (dependents) {
      for (const dep of dependents) {
        if (!toRecalc.has(dep)) {
          toRecalc.add(dep);
          queue.push(dep);
        }
      }
    }
  }

  return Array.from(toRecalc);
}

// Export helpers for use in the spreadsheet component
export {
  parseRef,
  getCellRef,
  colLetterToIndex,
  getColumnLetter,
  isError,
  toNumber,
  toString,
  toBoolean,
};
