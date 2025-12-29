/**
 * Tokenizer for code analysis
 * Ported from Lizard's CodeReader.generate_tokens
 *
 * Uses regex-based tokenization without full AST parsing
 */

/**
 * Token types for different languages
 */
export interface TokenizerOptions {
    /** Additional regex patterns for language-specific tokens */
    additionalPatterns?: string;
}

/**
 * Simple regex-based tokenizer
 * Extracts tokens from source code for complexity analysis
 */
export class Tokenizer {
    /**
     * Generate tokens from source code
     *
     * Based on Lizard's generate_tokens method which uses a comprehensive
     * regex pattern to extract all meaningful tokens including:
     * - Multi-line comments
     * - Single-line comments
     * - String literals
     * - Numbers (decimal, hex, binary)
     * - Identifiers and keywords
     * - Operators
     * - Brackets and punctuation
     *
     * @param sourceCode - The source code to tokenize
     * @param options - Optional tokenizer configuration
     * @returns Array of token strings
     */
    static generateTokens(sourceCode: string, options: TokenizerOptions = {}): string[] {
        const tokens: string[] = [];
        const { additionalPatterns = '' } = options;

        // Combined operator symbols that should be treated as single tokens
        const combinedSymbols = [
            '<<=', '>>=', '||', '&&', '===', '!==',
            '==', '!=', '<=', '>=', '->', '=>',
            '++', '--', '+=', '-=',
            '+', '-', '*', '/',
            '*=', '/=', '^=', '&=', '|=', '...'
        ];

        // Build the main token pattern
        // Order matters: longer patterns must come first
        const patternParts = [
            // Multi-line comments
            '\\/\\*[\\s\\S]*?\\*\\/',

            // Additional language-specific patterns
            additionalPatterns,

            // Numbers with digit separators (e.g., 1'000'000)
            "(?:\\d+')+\\d+",

            // Hex numbers with separators
            "0x(?:[0-9A-Fa-f]+')+[0-9A-Fa-f]+",

            // Binary numbers with separators
            "0b(?:[01]+')+[01]+",

            // Regular identifiers and keywords
            '\\w+',

            // Double-quoted strings with escapes
            '"(?:\\\\.|[^"\\\\])*"',

            // Single-quoted strings with escapes
            "'(?:\\\\.|[^'\\\\])*?'",

            // Single-line comments (until end of line)
            '\\/\\/[^\\n]*',

            // Preprocessor directives
            '#',

            // Special operators
            ':=', '::', '\\*\\*',

            // Generic type annotations (TypeScript/Java)
            '<(?=(?:[^<>]*\\?)+[^<>]*>)(?:[\\w\\s,.?]|(?:extends))+>',

            // Combined symbols (escaped for regex)
            ...combinedSymbols.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),

            // Line continuations
            '\\\\\\n',

            // Newlines
            '\\n',

            // Whitespace (not including newlines)
            '[^\\S\\n]+',

            // Any other single character
            '.'
        ].filter(p => p); // Remove empty patterns

        const tokenPattern = new RegExp(
            '(?:' + patternParts.join('|') + ')',
            'gm'
        );

        let match: RegExpExecArray | null;
        while ((match = tokenPattern.exec(sourceCode)) !== null) {
            const token = match[0];
            tokens.push(token);
        }

        return tokens;
    }

    /**
     * Filter out non-code tokens (comments, whitespace)
     * Useful for token counting
     */
    static filterCodeTokens(tokens: string[]): string[] {
        return tokens.filter(token => {
            // Skip whitespace
            if (/^\s+$/.test(token)) {
                return false;
            }

            // Skip comments
            if (token.startsWith('//') ||
                token.startsWith('/*') ||
                token.startsWith('#')) {
                return false;
            }

            return true;
        });
    }

    /**
     * Count non-blank, non-comment lines (NLOC)
     */
    static countNLOC(sourceCode: string): number {
        const lines = sourceCode.split('\n');
        let nloc = 0;
        let inMultiLineComment = false;

        for (let line of lines) {
            line = line.trim();

            // Check for multi-line comment start/end
            if (line.includes('/*')) {
                inMultiLineComment = true;
            }
            if (line.includes('*/')) {
                inMultiLineComment = false;
                continue;
            }

            // Skip if in multi-line comment
            if (inMultiLineComment) {
                continue;
            }

            // Skip blank lines
            if (line.length === 0) {
                continue;
            }

            // Skip single-line comments
            if (line.startsWith('//') || line.startsWith('#')) {
                continue;
            }

            nloc++;
        }

        return nloc;
    }
}
