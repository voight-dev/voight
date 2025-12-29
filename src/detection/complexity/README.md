# Complexity Analysis Module

This module provides cyclomatic complexity analysis for code segments, ported from the [Lizard](https://github.com/terryyin/lizard) Python project.

## Overview

The complexity module analyzes code segments and assigns a **complexity score from 1-10** based on:
- **Cyclomatic Complexity (CCN)** - 70% weight
- **Code Size (NLOC)** - 30% weight

This score helps filter AI-generated code segments, showing only complex code that warrants developer review.

## Phase 1 Implementation

Currently supports:
- **Languages**: TypeScript, JavaScript, Go, Python
- **Metrics**: CCN, NLOC, token count
- **Segment-level analysis** (function-level coming in Phase 2)

## Quick Start

```typescript
import { scoreSegment, ComplexityScorer } from './complexity';

// Score a code segment
const result = scoreSegment(code, 'myfile.ts');

console.log(`Score: ${result.score}/10`);
console.log(`CCN: ${result.ccn}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(result.score)}`);

// Filter segments by threshold
if (ComplexityScorer.shouldShowSegment(result.score, 5)) {
    // Show this segment to user
}
```

## Scoring Scale

| Score | CCN Range | Level | Meaning |
|-------|-----------|-------|---------|
| 1-3 | 1-5 | Low | Simple linear code, likely doesn't need review |
| 4-6 | 6-10 | Medium | Moderate branching, quick review recommended |
| 7-8 | 11-15 | High | Complex logic, thorough review needed |
| 9-10 | 16+ | Very High | Critical complexity, requires careful attention |

## What is Cyclomatic Complexity (CCN)?

CCN measures the number of independent paths through code by counting decision points:

**Decision Points:**
- Control flow: `if`, `for`, `while`, `catch`
- Logical operators: `&&`, `||` (or `and`, `or` in Python)
- Case statements: `case`
- Ternary operators: `?` (in languages that support it)

**Calculation:**
- Start with CCN = 1 (base complexity)
- Add 1 for each decision point
- Example: `if (a && b)` → CCN = 3 (1 base + 1 if + 1 &&)

## Examples

### Simple Code (Score: 1-2)

```typescript
function hello() {
    console.log("Hello");
    return 42;
}
// CCN: 1, Score: 1
```

### Moderate Complexity (Score: 4-5)

```typescript
function validate(x, y) {
    if (x > 0 && y > 0) {
        return true;
    } else if (x < 0 || y < 0) {
        return false;
    }
    return null;
}
// CCN: 5 (1 + 2 if + 1 && + 1 ||), Score: ~4-5
```

### High Complexity (Score: 8-9)

```typescript
function complex(a, b, c) {
    if (a > 0) {
        if (b > 0 && c > 0) {
            for (let i = 0; i < 10; i++) {
                if (i % 2 === 0) {
                    console.log(i);
                }
            }
        } else if (b < 0 || c < 0) {
            while (a > 0) {
                a--;
            }
        }
    }
    return a + b + c;
}
// CCN: 9, Score: ~8-9
```

## Architecture

```
complexity/
├── index.ts          # Public API
├── types.ts          # Type definitions
├── tokenizer.ts      # Regex-based tokenization
├── analyzer.ts       # CCN calculation
├── scorer.ts         # CCN → 1-10 score mapping
└── __tests__/        # Unit tests
```

## Integration with Detection System

The module is automatically integrated into the detection pipeline:

```typescript
// In changeDetector.ts
const blocks = detectChanges(document);

// Each block now includes:
block.complexityScore     // 1-10
block.complexityData.ccn  // Raw CCN
block.complexityData.nloc // Lines of code
block.complexityData.level // "Low", "Medium", "High", "Very High"
```

## Configuration

Default threshold: **Score ≥ 5** shows segments to users.

This can be adjusted:

```typescript
// Show only high complexity (7+)
if (ComplexityScorer.shouldShowSegment(score, 7)) {
    // ...
}

// Show all segments (1+)
if (ComplexityScorer.shouldShowSegment(score, 1)) {
    // ...
}
```

## ✅ Phase 2: Function-Level Detection (Completed!)

**Status**: Fully Implemented and Tested

Phase 2 adds per-function complexity detection:
- ✅ State machine for each language (Go, TypeScript, Python)
- ✅ Detect function boundaries with accurate names
- ✅ Track CCN per function independently
- ✅ Multi-function segments → List of functions with individual scores
- ✅ Automatic fallback to Phase 1 if detection fails
- ✅ Nesting depth tracking

### Example Output

For a file with 3 Go functions:
```
Functions detected: 3
  • whoamiHandler: CCN=3 (Low)
  • quadraticHandler: CCN=7 (High)
  • knapsackHandler: CCN=23 (Very High)
```

### Running Tests

Run the Phase 2 integration test:
```bash
npx ts-node src/detection/complexity/__tests__/test-phase2.ts
```

### Adding New Languages

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed instructions. Summary:
1. Create one state machine class extending `StateMachine` (~100-300 lines)
2. Register in `analyzer.ts` (3 small additions)
3. Export in `index.ts`
4. Test and you're done!

**The architecture is designed for easy extensibility** - adding a language doesn't require touching core logic.

## Future Enhancements

- [ ] More languages (Java, C#, Ruby, PHP, Rust, Swift, Kotlin)
- [ ] Cognitive Complexity scoring (alternative to CCN)
- [ ] Configurable thresholds via VSCode settings
- [ ] Performance optimizations for very large files (>10k lines)
- [ ] Incremental analysis (cache and re-analyze only changed functions)

## References

- [Lizard GitHub](https://github.com/terryyin/lizard) - Original Python implementation
- [Cyclomatic Complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity) - Wikipedia
- [Code Complexity Best Practices](https://www.sonarsource.com/docs/CognitiveComplexity.pdf) - Cognitive Complexity whitepaper

## Testing

Run tests:
```bash
npm test -- complexity
```

Test files include examples for TypeScript, JavaScript, Go, and Python with known CCN values.
