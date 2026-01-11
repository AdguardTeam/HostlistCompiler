/**
 * Safe boolean expression parser.
 * Replaces unsafe Function() constructor for evaluating preprocessor conditions.
 * Supports: true, false, !, &&, ||, (), and platform identifiers.
 */

/**
 * Token types for the lexer
 */
enum TokenType {
    TRUE = 'TRUE',
    FALSE = 'FALSE',
    NOT = 'NOT',
    AND = 'AND',
    OR = 'OR',
    LPAREN = 'LPAREN',
    RPAREN = 'RPAREN',
    IDENTIFIER = 'IDENTIFIER',
    EOF = 'EOF',
}

/**
 * Token representation
 */
interface Token {
    type: TokenType;
    value: string;
}

/**
 * Known platform identifiers
 */
const PLATFORM_IDENTIFIERS = new Set([
    'windows',
    'mac',
    'android',
    'ios',
    'ext_chromium',
    'ext_ff',
    'ext_edge',
    'ext_opera',
    'ext_safari',
    'ext_ublock',
    'adguard',
    'adguard_app_windows',
    'adguard_app_mac',
    'adguard_app_android',
    'adguard_app_ios',
    'adguard_ext_chromium',
    'adguard_ext_firefox',
    'adguard_ext_edge',
    'adguard_ext_opera',
    'adguard_ext_safari',
]);

/**
 * Tokenizes a boolean expression
 */
function tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;

    while (pos < expression.length) {
        // Skip whitespace
        while (pos < expression.length && /\s/.test(expression[pos])) {
            pos++;
        }

        if (pos >= expression.length) {
            break;
        }

        const char = expression[pos];

        // Single character tokens
        if (char === '(') {
            tokens.push({ type: TokenType.LPAREN, value: '(' });
            pos++;
            continue;
        }

        if (char === ')') {
            tokens.push({ type: TokenType.RPAREN, value: ')' });
            pos++;
            continue;
        }

        if (char === '!') {
            tokens.push({ type: TokenType.NOT, value: '!' });
            pos++;
            continue;
        }

        // Two character operators
        if (char === '&' && expression[pos + 1] === '&') {
            tokens.push({ type: TokenType.AND, value: '&&' });
            pos += 2;
            continue;
        }

        if (char === '|' && expression[pos + 1] === '|') {
            tokens.push({ type: TokenType.OR, value: '||' });
            pos += 2;
            continue;
        }

        // Identifiers (true, false, platform names)
        if (/[a-zA-Z_]/.test(char)) {
            let identifier = '';
            while (pos < expression.length && /[a-zA-Z0-9_]/.test(expression[pos])) {
                identifier += expression[pos];
                pos++;
            }

            const lowerIdentifier = identifier.toLowerCase();
            if (lowerIdentifier === 'true') {
                tokens.push({ type: TokenType.TRUE, value: 'true' });
            } else if (lowerIdentifier === 'false') {
                tokens.push({ type: TokenType.FALSE, value: 'false' });
            } else {
                tokens.push({ type: TokenType.IDENTIFIER, value: identifier });
            }
            continue;
        }

        // Unknown character - skip it
        pos++;
    }

    tokens.push({ type: TokenType.EOF, value: '' });
    return tokens;
}

/**
 * Recursive descent parser for boolean expressions
 */
class BooleanParser {
    private tokens: Token[];
    private pos: number;
    private platform: string | undefined;

    constructor(tokens: Token[], platform?: string) {
        this.tokens = tokens;
        this.pos = 0;
        this.platform = platform?.toLowerCase();
    }

    private current(): Token {
        return this.tokens[this.pos] || { type: TokenType.EOF, value: '' };
    }

    private advance(): Token {
        const token = this.current();
        this.pos++;
        return token;
    }

    /**
     * Parse: expression := orExpr
     */
    parse(): boolean {
        const result = this.parseOr();
        if (this.current().type !== TokenType.EOF) {
            // Remaining tokens - still valid, just ignore
        }
        return result;
    }

    /**
     * Parse: orExpr := andExpr ('||' andExpr)*
     */
    private parseOr(): boolean {
        let left = this.parseAnd();

        while (this.current().type === TokenType.OR) {
            this.advance(); // consume '||'
            const right = this.parseAnd();
            left = left || right;
        }

        return left;
    }

    /**
     * Parse: andExpr := notExpr ('&&' notExpr)*
     */
    private parseAnd(): boolean {
        let left = this.parseNot();

        while (this.current().type === TokenType.AND) {
            this.advance(); // consume '&&'
            const right = this.parseNot();
            left = left && right;
        }

        return left;
    }

    /**
     * Parse: notExpr := '!' notExpr | primary
     */
    private parseNot(): boolean {
        if (this.current().type === TokenType.NOT) {
            this.advance(); // consume '!'
            return !this.parseNot();
        }
        return this.parsePrimary();
    }

    /**
     * Parse: primary := 'true' | 'false' | identifier | '(' expression ')'
     */
    private parsePrimary(): boolean {
        const token = this.current();

        switch (token.type) {
            case TokenType.TRUE:
                this.advance();
                return true;

            case TokenType.FALSE:
                this.advance();
                return false;

            case TokenType.IDENTIFIER:
                this.advance();
                // Check if identifier matches current platform
                return this.evaluateIdentifier(token.value);

            case TokenType.LPAREN:
                this.advance(); // consume '('
                const result = this.parseOr();
                if (this.current().type === TokenType.RPAREN) {
                    this.advance(); // consume ')'
                }
                return result;

            default:
                // Unknown token, treat as false
                return false;
        }
    }

    /**
     * Evaluates a platform identifier
     */
    private evaluateIdentifier(identifier: string): boolean {
        const lowerIdentifier = identifier.toLowerCase();

        // If no platform specified, unknown identifiers are false
        if (!this.platform) {
            return false;
        }

        // Check for exact match
        return lowerIdentifier === this.platform;
    }
}

/**
 * Safely evaluates a boolean expression for preprocessor conditions.
 *
 * @param expression - The expression to evaluate (e.g., "windows && !ext_safari")
 * @param platform - Optional current platform identifier
 * @returns The boolean result of the expression
 *
 * @example
 * ```typescript
 * evaluateBooleanExpression('true'); // true
 * evaluateBooleanExpression('!false'); // true
 * evaluateBooleanExpression('windows', 'windows'); // true
 * evaluateBooleanExpression('windows', 'mac'); // false
 * evaluateBooleanExpression('windows || mac', 'mac'); // true
 * evaluateBooleanExpression('windows && !ext_safari', 'windows'); // true
 * ```
 */
export function evaluateBooleanExpression(expression: string, platform?: string): boolean {
    // Handle empty or whitespace-only expressions
    const trimmed = expression.trim();
    if (!trimmed) {
        return true; // Empty condition defaults to true
    }

    try {
        const tokens = tokenize(trimmed);
        const parser = new BooleanParser(tokens, platform);
        return parser.parse();
    } catch {
        // If parsing fails, default to false (exclude the conditional block)
        return false;
    }
}

/**
 * Checks if an identifier is a known platform
 */
export function isKnownPlatform(identifier: string): boolean {
    return PLATFORM_IDENTIFIERS.has(identifier.toLowerCase());
}

/**
 * Gets all known platform identifiers
 */
export function getKnownPlatforms(): string[] {
    return Array.from(PLATFORM_IDENTIFIERS);
}
