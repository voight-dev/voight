/**
 * Function Boundary Detector
 *
 * Extracts function boundaries from source code using simple pattern matching.
 * This is a workaround since state machine line tracking isn't fully implemented yet.
 */

import { FunctionInfo, Language } from './types';

export interface FunctionBoundary {
    name: string;
    startLine: number;  // 0-indexed
    endLine: number;    // 0-indexed
}

export class FunctionBoundaryDetector {
    /**
     * Extract function boundaries from source code
     */
    public static detectBoundaries(
        sourceCode: string,
        functions: FunctionInfo[],
        language: Language
    ): FunctionBoundary[] {
        const lines = sourceCode.split('\n');
        const boundaries: FunctionBoundary[] = [];

        // console.log('[BoundaryDetector] Detecting boundaries for functions:', functions.map(f => f.name));

        for (const func of functions) {
            const boundary = this.findFunctionBoundary(lines, func.name, language);
            if (boundary) {
                // console.log(`[BoundaryDetector] Found boundary for "${func.name}": lines ${boundary.startLine}-${boundary.endLine}`);
                boundaries.push(boundary);
            } else {
                // console.warn(`[BoundaryDetector] Could not find boundary for function: ${func.name}`);
            }
        }

        // console.log('[BoundaryDetector] Final boundaries order:', boundaries.map(b => `${b.name}:${b.startLine}-${b.endLine}`));
        return boundaries;
    }

    /**
     * Find start and end line of a function by name
     */
    private static findFunctionBoundary(
        lines: string[],
        functionName: string,
        language: Language
    ): FunctionBoundary | null {
        // Python uses indentation-based blocks, not braces
        if (language === Language.Python) {
            return this.findPythonFunctionBoundary(lines, functionName);
        }

        // For brace-based languages (Go, JS, TS)
        return this.findBraceFunctionBoundary(lines, functionName, language);
    }

    /**
     * Find Python function boundary using indentation
     */
    private static findPythonFunctionBoundary(
        lines: string[],
        functionName: string
    ): FunctionBoundary | null {
        // console.log(`[BoundaryDetector] Searching for Python function: "${functionName}"`);

        let startLine = -1;
        let baseIndentation = -1;

        // Find function start
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Log lines that start with "def " to see what's actually there
            if (trimmed.startsWith('def ')) {
                // console.log(`[BoundaryDetector] Line ${i}: ${trimmed}`);
            }

            // Check if this is the function definition
            if (this.isFunctionDeclaration(trimmed, functionName, Language.Python)) {
                // console.log(`[BoundaryDetector] ✓ Found match for "${functionName}" at line ${i}`);
                startLine = i;
                // Get the indentation level of the def line
                baseIndentation = line.length - line.trimStart().length;

                // Find the end of the function by looking for the next line with same/less indentation
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    const nextTrimmed = nextLine.trim();

                    // Skip empty lines and comments
                    if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
                        continue;
                    }

                    // Calculate indentation of this line
                    const nextIndentation = nextLine.length - nextLine.trimStart().length;

                    // If we find a line with same or less indentation, the function ends at previous line
                    if (nextIndentation <= baseIndentation) {
                        // Found end of function - it's the line before this one
                        return {
                            name: functionName,
                            startLine,
                            endLine: j - 1
                        };
                    }
                }

                // If we reach here, function goes to end of file
                return {
                    name: functionName,
                    startLine,
                    endLine: lines.length - 1
                };
            }
        }

        // Function not found
        // console.warn(`[BoundaryDetector] ✗ Could not find Python function: "${functionName}"`);
        return null;
    }

    /**
     * Find function boundary using brace counting (for Go, JS, TS)
     */
    private static findBraceFunctionBoundary(
        lines: string[],
        functionName: string,
        language: Language
    ): FunctionBoundary | null {
        // Special handling for anonymous functions
        if (functionName === '(anonymous)') {
            return this.findAnonymousFunctionBoundary(lines, language);
        }

        let startLine = -1;
        let braceDepth = 0;
        let inFunction = false;

        // Find function start
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!inFunction) {
                // Check if this line contains the function declaration
                if (this.isFunctionDeclaration(line, functionName, language)) {
                    startLine = i;
                    inFunction = true;

                    // Check if opening brace is on same line
                    const openBraces = (line.match(/\{/g) || []).length;
                    const closeBraces = (line.match(/\}/g) || []).length;
                    braceDepth += openBraces - closeBraces;

                    if (braceDepth === 0) {
                        continue;  // Keep looking for opening brace
                    }
                }
            } else {
                // Track braces to find function end
                const openBraces = (line.match(/\{/g) || []).length;
                const closeBraces = (line.match(/\}/g) || []).length;
                braceDepth += openBraces - closeBraces;

                if (braceDepth === 0) {
                    // Found end of function
                    return {
                        name: functionName,
                        startLine,
                        endLine: i
                    };
                }
            }
        }

        // Function not closed properly or not found
        return null;
    }

    /**
     * Find anonymous function boundary for JavaScript/TypeScript
     * Looks for arrow functions, function expressions, etc.
     */
    private static findAnonymousFunctionBoundary(
        lines: string[],
        language: Language
    ): FunctionBoundary | null {
        if (language !== Language.JavaScript && language !== Language.TypeScript) {
            return null;
        }

        // Look for arrow functions or anonymous function expressions
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for arrow function or anonymous function
            const isArrowFunction = /=>\s*\{/.test(line) || /=>\s*[^{]/.test(line);
            const isAnonFunction = /function\s*\(/.test(line);

            if (isArrowFunction || isAnonFunction) {
                const startLine = i;

                // Check if it's a single-line arrow function (no braces)
                if (isArrowFunction && !/=>\s*\{/.test(line)) {
                    // Single-line arrow function
                    return {
                        name: '(anonymous)',
                        startLine,
                        endLine: i
                    };
                }

                // Multi-line function - use brace counting
                let braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

                if (braceDepth === 0) {
                    // Opening brace might be on next line
                    continue;
                }

                // Track braces to find end
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    const openBraces = (nextLine.match(/\{/g) || []).length;
                    const closeBraces = (nextLine.match(/\}/g) || []).length;
                    braceDepth += openBraces - closeBraces;

                    if (braceDepth === 0) {
                        return {
                            name: '(anonymous)',
                            startLine,
                            endLine: j
                        };
                    }
                }

                // If we get here, braces weren't balanced - return what we found
                return {
                    name: '(anonymous)',
                    startLine,
                    endLine: lines.length - 1
                };
            }
        }

        return null;
    }

    /**
     * Check if line contains function declaration
     */
    private static isFunctionDeclaration(
        line: string,
        functionName: string,
        language: Language
    ): boolean {
        switch (language) {
            case Language.Go:
                // func functionName(
                // func (receiver Type) functionName(
                return /^\s*func\s+/.test(line) && line.includes(functionName);

            case Language.TypeScript:
            case Language.JavaScript:
                // function functionName(
                // const functionName = (
                // functionName(
                // async function functionName(
                return (
                    /^\s*function\s+/.test(line) && line.includes(functionName) ||
                    /^\s*async\s+function\s+/.test(line) && line.includes(functionName) ||
                    /^\s*const\s+/.test(line) && line.includes(functionName) ||
                    /^\s*let\s+/.test(line) && line.includes(functionName) ||
                    /^\s*var\s+/.test(line) && line.includes(functionName) ||
                    new RegExp(`^\\s*${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`).test(line) ||
                    new RegExp(`^\\s*${functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`).test(line)
                );

            case Language.Python:
                // def functionName(
                return /^\s*def\s+/.test(line) && line.includes(functionName);

            default:
                return false;
        }
    }
}
