/**
 * Test script for Phase 2 function-level detection
 *
 * Run with: npx ts-node src/detection/complexity/__tests__/test-phase2.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ComplexityAnalyzer } from '../analyzer';
import { ComplexityScorer } from '../scorer';

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m'
};

function getComplexityColor(ccn: number): string {
    if (ccn <= 3) return colors.green;
    if (ccn <= 6) return colors.yellow;
    if (ccn <= 8) return colors.yellow + colors.bright;
    return colors.red;
}

function testGoExample() {
    console.log(`\n${colors.bright}${colors.blue}=== Testing Phase 2: Go Multi-Function Detection ===${colors.reset}\n`);

    const goFilePath = path.join(__dirname, 'test-go-example.go');
    const goCode = fs.readFileSync(goFilePath, 'utf-8');

    console.log(`${colors.bright}File:${colors.reset} ${goFilePath}`);
    console.log(`${colors.bright}Lines:${colors.reset} ${goCode.split('\n').length}\n`);

    // Analyze the code
    const analyzer = ComplexityAnalyzer.forFile(goFilePath);
    const result = analyzer.analyze(goCode);

    console.log(`${colors.bright}${colors.blue}Analysis Results:${colors.reset}`);
    console.log(`  Total CCN: ${result.totalCCN}`);
    console.log(`  NLOC: ${result.nloc}`);
    console.log(`  Functions detected: ${result.functions.length}\n`);

    // Score the overall code
    const score = ComplexityScorer.scoreAnalysis(result);
    console.log(`${colors.bright}Overall Complexity Score:${colors.reset} ${score.score}/10 (${ComplexityScorer.getComplexityLevel(score.score)})\n`);

    // Print each function
    console.log(`${colors.bright}${colors.blue}Individual Functions:${colors.reset}\n`);

    if (result.functions.length === 0) {
        console.log(`${colors.red}❌ No functions detected! Phase 2 implementation may have issues.${colors.reset}`);
        return false;
    }

    result.functions.forEach((fn, idx) => {
        const color = getComplexityColor(fn.cyclomaticComplexity);
        const level = fn.cyclomaticComplexity <= 3 ? 'Low' :
                      fn.cyclomaticComplexity <= 6 ? 'Medium' :
                      fn.cyclomaticComplexity <= 8 ? 'High' : 'Very High';

        console.log(`${idx + 1}. ${colors.bright}${fn.name}${colors.reset}`);
        console.log(`   Location: Lines ${fn.startLine}-${fn.endLine}`);
        console.log(`   CCN: ${color}${fn.cyclomaticComplexity}${colors.reset} (${level})`);
        console.log(`   NLOC: ${fn.nloc}`);
        console.log(`   Parameters: ${fn.parameterCount}`);
        console.log(`   Signature: ${fn.longName}`);
        console.log();
    });

    // Verify expected functions
    const expectedFunctions = ['whoamiHandler', 'quadraticHandler', 'knapsackHandler'];
    const detectedNames = result.functions.map(f => f.name);

    console.log(`${colors.bright}${colors.blue}Verification:${colors.reset}`);
    expectedFunctions.forEach(name => {
        if (detectedNames.includes(name)) {
            console.log(`  ${colors.green}✓${colors.reset} Found ${name}`);
        } else {
            console.log(`  ${colors.red}✗${colors.reset} Missing ${name}`);
        }
    });

    const allFound = expectedFunctions.every(name => detectedNames.includes(name));
    if (allFound) {
        console.log(`\n${colors.green}${colors.bright}✓ Phase 2 Implementation Success!${colors.reset}`);
        console.log(`  All expected functions were detected with per-function CCN tracking.`);
        return true;
    } else {
        console.log(`\n${colors.red}${colors.bright}✗ Phase 2 Implementation Incomplete${colors.reset}`);
        console.log(`  Some functions were not detected.`);
        return false;
    }
}

// Run the test
try {
    const success = testGoExample();
    process.exit(success ? 0 : 1);
} catch (error) {
    console.error(`${colors.red}${colors.bright}Error running test:${colors.reset}`, error);
    process.exit(1);
}
