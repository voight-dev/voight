/**
 * Example usage of the Complexity Analysis Module
 * Run this file to see complexity scoring in action
 */

import { scoreSegment, analyzeCode, ComplexityScorer, Language } from './index';

// Example 1: Simple function
const simpleCode = `
function hello() {
    console.log("Hello, World!");
    return 42;
}
`;

console.log('=== Example 1: Simple Function ===');
const simple = scoreSegment(simpleCode, 'test.ts');
console.log(`Score: ${simple.score}/10`);
console.log(`CCN: ${simple.ccn}`);
console.log(`NLOC: ${simple.nloc}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(simple.score)}`);
console.log(`Show to user? ${ComplexityScorer.shouldShowSegment(simple.score)}`);
console.log();

// Example 2: Moderate complexity
const moderateCode = `
function validate(x, y, z) {
    if (x > 0 && y > 0) {
        if (z > 0) {
            return true;
        }
    } else if (x < 0 || y < 0) {
        return false;
    }
    return null;
}
`;

console.log('=== Example 2: Moderate Complexity ===');
const moderate = scoreSegment(moderateCode, 'test.ts');
console.log(`Score: ${moderate.score}/10`);
console.log(`CCN: ${moderate.ccn}`);
console.log(`NLOC: ${moderate.nloc}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(moderate.score)}`);
console.log(`Show to user? ${ComplexityScorer.shouldShowSegment(moderate.score)}`);
console.log();

// Example 3: High complexity
const complexCode = `
function processData(data, options, callback) {
    if (!data || !data.length) {
        return callback(new Error('No data'));
    }

    for (let i = 0; i < data.length; i++) {
        const item = data[i];

        if (item.type === 'A') {
            if (options.validateA && item.value > 0) {
                try {
                    processTypeA(item);
                } catch (e) {
                    if (e.code === 'INVALID') {
                        handleInvalid(item);
                    } else if (e.code === 'FATAL') {
                        return callback(e);
                    }
                }
            }
        } else if (item.type === 'B' || item.type === 'C') {
            while (item.queue.length > 0) {
                const queued = item.queue.shift();
                if (queued.priority > 5) {
                    processImmediate(queued);
                }
            }
        }
    }

    callback(null, 'Success');
}
`;

console.log('=== Example 3: High Complexity ===');
const complex = scoreSegment(complexCode, 'test.ts');
console.log(`Score: ${complex.score}/10`);
console.log(`CCN: ${complex.ccn}`);
console.log(`NLOC: ${complex.nloc}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(complex.score)}`);
console.log(`Show to user? ${ComplexityScorer.shouldShowSegment(complex.score)}`);
console.log();

// Example 4: Go code
const goCode = `
func processRequest(req *Request) error {
    if req == nil {
        return errors.New("nil request")
    }

    for _, item := range req.Items {
        if item.Status == "pending" {
            if err := validate(item); err != nil {
                return err
            }
        } else if item.Status == "active" {
            process(item)
        }
    }

    return nil
}
`;

console.log('=== Example 4: Go Code ===');
const goExample = scoreSegment(goCode, 'test.go');
console.log(`Score: ${goExample.score}/10`);
console.log(`CCN: ${goExample.ccn}`);
console.log(`NLOC: ${goExample.nloc}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(goExample.score)}`);
console.log();

// Example 5: Python code
const pythonCode = `
def analyze_data(data, options):
    if not data:
        return None

    results = []
    for item in data:
        if item['type'] == 'A' and item['value'] > 0:
            try:
                result = process_a(item)
                results.append(result)
            except ValueError:
                handle_error(item)
            except KeyError:
                skip_item(item)
        elif item['type'] == 'B' or item['type'] == 'C':
            if validate(item):
                results.append(process_bc(item))

    return results
`;

console.log('=== Example 5: Python Code ===');
const pythonExample = scoreSegment(pythonCode, 'test.py');
console.log(`Score: ${pythonExample.score}/10`);
console.log(`CCN: ${pythonExample.ccn}`);
console.log(`NLOC: ${pythonExample.nloc}`);
console.log(`Level: ${ComplexityScorer.getComplexityLevel(pythonExample.score)}`);
console.log();

// Summary
console.log('=== Threshold Filtering ===');
console.log('With default threshold of 5:');
const examples = [simple, moderate, complex, goExample, pythonExample];
const shown = examples.filter(e => ComplexityScorer.shouldShowSegment(e.score));
console.log(`Would show ${shown.length}/${examples.length} segments to user`);
console.log(`Hidden: ${examples.length - shown.length} (low complexity, likely doesn't need review)`);
