/**
 * Simple content hashing for segment staleness detection
 * Uses a fast, non-cryptographic hash for comparing code content
 */

/**
 * Generate a simple hash of a string
 * Uses djb2 algorithm - fast and good distribution
 */
export function hashContent(content: string): string {
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) + hash) + content.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to hex string for readability
    return (hash >>> 0).toString(16);
}

/**
 * Extract content from a document at specific line range
 * Returns the text content at those lines
 */
export function getContentAtLines(
    lines: string[],
    startLine: number,
    endLine: number
): string {
    const start = Math.max(0, startLine);
    const end = Math.min(lines.length - 1, endLine);

    if (start > end || start >= lines.length) {
        return '';
    }

    return lines.slice(start, end + 1).join('\n');
}

/**
 * Check if content at given lines matches a stored hash
 */
export function contentMatchesHash(
    lines: string[],
    startLine: number,
    endLine: number,
    storedHash: string
): boolean {
    const content = getContentAtLines(lines, startLine, endLine);
    const currentHash = hashContent(content);
    return currentHash === storedHash;
}
