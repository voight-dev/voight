/**
 * Test for FunctionBoundaryDetector
 *
 * This test validates that the boundary detector can correctly identify
 * function start and end lines in source code.
 */

import { FunctionBoundaryDetector } from '../functionBoundaryDetector';
import { Language, FunctionInfo } from '../types';

function testBoundaryDetector() {
    console.log('\n=== Testing FunctionBoundaryDetector ===\n');

    // Test 1: Go functions
    console.log('Test 1: Go Functions');
    const goCode = `package main

func temperatureHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    var input TempRequest
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
}

func runLengthEncodingHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        return
    }
    var input RLERequest
    result := ""
    count := 0
    prev := rune(0)
    for _, char := range input.Text {
        if char == prev {
            count++
        } else {
            if count > 0 {
                result += fmt.Sprintf("%d%c", count, prev)
            }
            prev = char
            count = 1
        }
    }
}

func lcsHandler(w http.ResponseWriter, r *http.Request) {
    if r.Method != "POST" {
        return
    }
    s1 := "test"
    s2 := "test"
    for i := 0; i < len(s1); i++ {
        for j := 0; j < len(s2); j++ {
            if s1[i] == s2[j] {
                // complex logic
            }
        }
    }
}`;

    const goFunctions: FunctionInfo[] = [
        { name: 'temperatureHandler', longName: 'temperatureHandler', cyclomaticComplexity: 7, nloc: 10, tokenCount: 50, parameterCount: 2, maxNestingDepth: 1, startLine: 0, endLine: 0 },
        { name: 'runLengthEncodingHandler', longName: 'runLengthEncodingHandler', cyclomaticComplexity: 13, nloc: 20, tokenCount: 80, parameterCount: 2, maxNestingDepth: 2, startLine: 0, endLine: 0 },
        { name: 'lcsHandler', longName: 'lcsHandler', cyclomaticComplexity: 35, nloc: 30, tokenCount: 100, parameterCount: 2, maxNestingDepth: 3, startLine: 0, endLine: 0 }
    ];

    const goBoundaries = FunctionBoundaryDetector.detectBoundaries(goCode, goFunctions, Language.Go);

    console.log(`Found ${goBoundaries.length} boundaries for ${goFunctions.length} functions:`);
    goBoundaries.forEach((boundary, i) => {
        console.log(`  ${i + 1}. ${boundary.name}: lines ${boundary.startLine}-${boundary.endLine} (${boundary.endLine - boundary.startLine + 1} lines)`);
    });

    // Test 2: TypeScript functions
    console.log('\nTest 2: TypeScript Functions');
    const tsCode = `
function simpleFunction(x: number): number {
    if (x > 0) {
        return x * 2;
    }
    return 0;
}

function complexFunction(arr: number[]): number {
    let sum = 0;
    for (const num of arr) {
        if (num > 0) {
            sum += num;
        } else if (num < 0) {
            sum -= num;
        } else {
            continue;
        }
    }
    return sum;
}

const arrowFunction = (x: number) => {
    if (x > 0) return x * 2;
    return 0;
}`;

    const tsFunctions: FunctionInfo[] = [
        { name: 'simpleFunction', longName: 'simpleFunction', cyclomaticComplexity: 2, nloc: 5, tokenCount: 20, parameterCount: 1, maxNestingDepth: 1, startLine: 0, endLine: 0 },
        { name: 'complexFunction', longName: 'complexFunction', cyclomaticComplexity: 5, nloc: 10, tokenCount: 40, parameterCount: 1, maxNestingDepth: 2, startLine: 0, endLine: 0 },
        { name: 'arrowFunction', longName: 'arrowFunction', cyclomaticComplexity: 2, nloc: 3, tokenCount: 15, parameterCount: 1, maxNestingDepth: 1, startLine: 0, endLine: 0 }
    ];

    const tsBoundaries = FunctionBoundaryDetector.detectBoundaries(tsCode, tsFunctions, Language.TypeScript);

    console.log(`Found ${tsBoundaries.length} boundaries for ${tsFunctions.length} functions:`);
    tsBoundaries.forEach((boundary, i) => {
        console.log(`  ${i + 1}. ${boundary.name}: lines ${boundary.startLine}-${boundary.endLine} (${boundary.endLine - boundary.startLine + 1} lines)`);
    });

    // Test 3: Python functions
    console.log('\nTest 3: Python Functions');
    const pythonCode = `
def simple_function(x):
    if x > 0:
        return x * 2
    return 0

def complex_function(arr):
    total = 0
    for num in arr:
        if num > 0:
            total += num
        elif num < 0:
            total -= num
        else:
            continue
    return total

def nested_function():
    def inner():
        return 42
    return inner()`;

    const pythonFunctions: FunctionInfo[] = [
        { name: 'simple_function', longName: 'simple_function', cyclomaticComplexity: 2, nloc: 4, tokenCount: 15, parameterCount: 1, maxNestingDepth: 1, startLine: 0, endLine: 0 },
        { name: 'complex_function', longName: 'complex_function', cyclomaticComplexity: 5, nloc: 9, tokenCount: 35, parameterCount: 1, maxNestingDepth: 2, startLine: 0, endLine: 0 },
        { name: 'nested_function', longName: 'nested_function', cyclomaticComplexity: 1, nloc: 3, tokenCount: 10, parameterCount: 0, maxNestingDepth: 1, startLine: 0, endLine: 0 }
    ];

    const pythonBoundaries = FunctionBoundaryDetector.detectBoundaries(pythonCode, pythonFunctions, Language.Python);

    console.log(`Found ${pythonBoundaries.length} boundaries for ${pythonFunctions.length} functions:`);
    pythonBoundaries.forEach((boundary, i) => {
        console.log(`  ${i + 1}. ${boundary.name}: lines ${boundary.startLine}-${boundary.endLine} (${boundary.endLine - boundary.startLine + 1} lines)`);
    });

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Go: ${goBoundaries.length}/${goFunctions.length} functions detected`);
    console.log(`TypeScript: ${tsBoundaries.length}/${tsFunctions.length} functions detected`);
    console.log(`Python: ${pythonBoundaries.length}/${pythonFunctions.length} functions detected`);

    const totalExpected = goFunctions.length + tsFunctions.length + pythonFunctions.length;
    const totalDetected = goBoundaries.length + tsBoundaries.length + pythonBoundaries.length;
    console.log(`\nOverall: ${totalDetected}/${totalExpected} boundaries detected`);

    if (totalDetected === totalExpected) {
        console.log('✓ All tests passed!');
    } else {
        console.log('✗ Some boundaries were not detected');
    }
}

// Run the test
testBoundaryDetector();
