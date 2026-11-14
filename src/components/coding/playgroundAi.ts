/**
 * Code Editor "AI" assist — ported 1:1 from the desktop playground
 * (codingkidadesktop/src/renderer/coding-playground.js).
 *
 * No AI network calls: everything is derived from the problem's preloaded
 * best solution (GET /api/coding-problems/best-solution) with pattern matching,
 * so hints / algorithm / next step / analyze are instant and free.
 */
import type { BestSolution, LangSolution } from '@/api';

/** The solution object for the selected language (new or old single-language shape). */
export function getLangSolution(sol: BestSolution | null, langId: string): LangSolution | null {
  if (!sol) return null;
  const per = (sol as unknown as Record<string, LangSolution | undefined>)[langId];
  if (per && per.code) return per;
  if (sol.code && sol.language === langId) return sol;
  return null;
}

// ── Hints ────────────────────────────────────────────────────────────────────
export function extractHints(code: string): string[] {
  if (!code) return ['Think about the problem step by step.'];
  const hints: string[] = [];

  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[/.test(code)) hints.push('Consider using a Hash Map/Dictionary for O(1) lookups.');
  if (/\bSet\b|\bHashSet\b|\bset\(\)|\bunordered_set\b/.test(code)) hints.push('A Set can help track unique elements efficiently.');
  if (/\bStack\b|\bstack\b|\bLifoQueue\b|\bpush\b.*\bpop\b/.test(code)) hints.push('A Stack (LIFO) structure might be useful here.');
  if (/\bQueue\b|\bqueue\b|\bdeque\b|\bLinkedList\b/.test(code)) hints.push('Think about using a Queue (FIFO) for processing order.');
  if (/\bPriorityQueue\b|\bheapq\b|\bheap\b/.test(code)) hints.push('A Priority Queue/Heap can optimize finding min/max efficiently.');

  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b/.test(code)) hints.push('Sorting the input first might simplify the problem.');
  if (/while.*left.*right|while.*lo.*hi|while.*start.*end/.test(code)) hints.push('Two-pointer or Binary Search technique could work here.');
  if (
    /function.*\(.*\).*\{[\s\S]*function.*\(|def.*:[\s\S]*def.*:|\brecur/.test(code) ||
    /\(.*n\s*-\s*1\)|\(.*n\s*\/\s*2\)/.test(code)
  ) hints.push('This problem might benefit from a recursive/divide-and-conquer approach.');
  if (/\bdp\b|\bmemo\b|\bcache\b|\btabulation\b/.test(code)) hints.push('Dynamic Programming (memoization/tabulation) is key to optimal solution.');
  if (/for.*for|while.*while/.test(code) && !/\bdp\b/.test(code)) hints.push('Nested iteration is used — think about optimizing inner loop.');
  if (/Math\.max|Math\.min|max\(|min\(|fmax|fmin/.test(code)) hints.push('Track running maximum/minimum values as you iterate.');
  if (/\bswap\b|temp\s*=/.test(code)) hints.push('In-place swapping technique is part of the solution.');
  if (/\bXOR\b|\^=|\^\s/.test(code)) hints.push('XOR bitwise operation has a useful property here.');
  if (/\.length|\.size|len\(/.test(code) && /-\s*1/.test(code)) hints.push('Pay attention to array bounds (length - 1).');

  if (hints.length === 0) {
    const loopCount = (code.match(/\bfor\b|\bwhile\b/g) || []).length;
    if (loopCount === 1) hints.push('A single pass through the data is sufficient.');
    else if (loopCount === 2) hints.push('Two passes (or a nested structure) are needed.');
    hints.push('Break the problem into smaller sub-problems.');
    hints.push('Think about edge cases: empty input, single element, duplicates.');
  }
  if (hints.length < 4) hints.push('Read input carefully and handle edge cases first.');
  return hints.slice(0, 5);
}

// ── Algorithm ────────────────────────────────────────────────────────────────
export interface AlgoInfo { name: string; explanation: string; steps: string[] }

export function detectAlgorithm(code: string): AlgoInfo {
  if (!code) return { name: 'Unknown', explanation: 'Could not analyze.', steps: [] };

  if (/while.*left.*right|while.*lo.*hi|while.*i.*j/.test(code) && /left\+\+|right--|lo\+\+|hi--|i\+\+|j--/.test(code)) {
    return { name: 'Two Pointer Technique', explanation: 'Uses two pointers moving from opposite ends (or same direction) to find a solution in O(n) time without extra space. Avoids brute-force nested loops.', steps: ['Initialize two pointers (left at start, right at end)', 'Compare elements at both pointers', 'Move the pointer that helps approach the target', 'Repeat until pointers meet or condition is satisfied'] };
  }
  if (/while.*low.*high|while.*lo.*hi|while.*left.*right/.test(code) && /mid\s*=|mid\s*\+|\/\s*2/.test(code)) {
    return { name: 'Binary Search', explanation: 'Divides the search space in half each iteration, achieving O(log n) time complexity. Works on sorted data or monotonic conditions.', steps: ['Define search boundaries (low, high)', 'Calculate mid point', 'Compare mid with target — narrow search to left or right half', 'Repeat until element found or boundaries cross'] };
  }
  if (/\bdp\b|\bmemo\b|\btabulation\b|\bcache\b/.test(code) || (/\bnew\s+(int|Integer|Array)/.test(code) && /\[.*\+\s*1\]/.test(code) && /dp\[|memo\[/.test(code))) {
    return { name: 'Dynamic Programming', explanation: 'Breaks problem into overlapping sub-problems and stores results to avoid recomputation. Builds solution bottom-up (tabulation) or top-down (memoization).', steps: ['Identify the state (what changes between sub-problems)', 'Define recurrence relation (how states relate)', 'Initialize base cases', 'Fill DP table iteratively or recursively with memoization', 'Return final state as answer'] };
  }
  if (/function\s+\w+.*\(.*\)[\s\S]{0,50}function\s+\w+.*\(/.test(code) || /def\s+\w+.*:[\s\S]{0,200}def\s+\w+/.test(code) || /\bbacktrack\b|\brecurse\b/.test(code)) {
    return { name: 'Recursion / Backtracking', explanation: 'Explores all possible solutions by making choices and undoing them (backtracking) when they lead to dead ends. Useful for combinatorial problems.', steps: ['Define base case (when to stop)', 'Make a choice and recurse on remaining sub-problem', 'If choice leads to invalid state, undo (backtrack)', 'Collect valid solutions'] };
  }
  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b|\bCollections\.sort\b/.test(code)) {
    if (/greedy|max.*min|min.*max/.test(code) || !/for.*for/.test(code)) {
      return { name: 'Sorting + Greedy Approach', explanation: 'Sorts input to establish order, then makes locally optimal choices at each step. Greedy works when local optimum leads to global optimum.', steps: ['Sort the input array/list', 'Iterate through sorted data', 'At each step, make the greedy choice (pick best local option)', 'Build result incrementally'] };
    }
    return { name: 'Sorting-Based Approach', explanation: 'Sorts the input first to simplify the problem. After sorting, patterns become easier to detect (duplicates, pairs, ranges).', steps: ['Sort the input data', 'Use the sorted order to efficiently find answer', 'Handle edge cases (empty array, single element)'] };
  }
  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[|\b{}\b/.test(code) && /\bget\b|\b\[.*\]\s*=/.test(code)) {
    return { name: 'Hash Map / Frequency Counting', explanation: 'Uses a hash map to store values for O(1) lookup. Common for counting frequencies, finding pairs, or tracking seen elements.', steps: ['Create a hash map/dictionary', 'Iterate through input, storing relevant data in map', 'Use O(1) lookup to check conditions or find answers', 'Return result based on map contents'] };
  }
  if (/window|slide|shrink/.test(code) || (/while/.test(code) && /start\+\+|left\+\+|i\+\+/.test(code) && /end|right|j/.test(code) && /sum|count|max|min/.test(code))) {
    return { name: 'Sliding Window', explanation: 'Maintains a window of elements that expands or shrinks based on conditions. Efficiently processes contiguous subarrays/substrings in O(n).', steps: ['Initialize window boundaries (start, end)', 'Expand window by moving end pointer', 'When condition violated, shrink window from start', 'Track best result (max/min) during process'] };
  }
  if ((code.match(/\bfor\b|\bwhile\b/g) || []).length === 1) {
    return { name: 'Single-Pass Linear Scan', explanation: 'Solves the problem in a single pass through the data (O(n)). Maintains running state variables to track the answer.', steps: ['Initialize result/tracking variables', 'Iterate through input once', 'Update tracking variables at each step', 'Return final result after loop'] };
  }
  if ((code.match(/\bfor\b/g) || []).length >= 2 || /for.*for/.test(code)) {
    return { name: 'Nested Iteration', explanation: 'Uses nested loops to check all pairs or sub-problems. May be O(n²) but is sometimes the simplest correct approach for the given constraints.', steps: ['Outer loop iterates through each element', 'Inner loop checks against remaining elements', 'Track best result found', 'Optimize if possible with early termination'] };
  }
  return { name: 'Iterative Approach', explanation: 'Uses straightforward iteration to solve the problem. Focus on handling edge cases correctly.', steps: ['Read and parse input', 'Process data with appropriate logic', 'Handle edge cases', 'Output result'] };
}

// ── Next Step ────────────────────────────────────────────────────────────────
function normalizeLine(line: string): string {
  return line
    .replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ')')
    .replace(/\s*\{\s*/g, '{')
    .replace(/\s*\}\s*/g, '}')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*<\s*/g, '<')
    .replace(/\s*>\s*/g, '>')
    .replace(/\s*=\s*/g, '=')
    .trim()
    .toLowerCase();
}

/** The next solution line the student hasn't written yet, or null if all covered. */
export function nextStepLine(solutionCode: string, userCode: string): string | null {
  const solItems = solutionCode.split('\n')
    .map((l) => ({ original: l, norm: normalizeLine(l) }))
    .filter((i) => i.norm.length > 0);
  const userNorms = userCode.split('\n').map(normalizeLine).filter((n) => n.length > 0);

  let userIdx = 0;
  let matched = 0;
  for (let si = 0; si < solItems.length; si++) {
    let found = false;
    for (let ui = userIdx; ui < userNorms.length; ui++) {
      if (solItems[si].norm === userNorms[ui]) {
        matched = si + 1;
        userIdx = ui + 1;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return solItems[matched] ? solItems[matched].original : null;
}

// ── Analyze mistakes ─────────────────────────────────────────────────────────
export interface AnalyzeResult { match: boolean; coverage: number; missing: string[]; extra: string[] }

export function analyzeMistake(solutionCode: string, userCode: string): AnalyzeResult {
  const trimLines = (c: string) => c.split('\n').map((l) => l.trim()).filter((l) => l);
  const key = (l: string) => l.length > 2 && l !== '{' && l !== '}' && l !== '};';
  const solKey = trimLines(solutionCode).filter(key);
  const userKey = trimLines(userCode).filter(key);
  const sq = (s: string) => s.replace(/\s+/g, '');

  const missing = solKey.filter((sl) => !userKey.some((ul) => ul === sl || sq(ul) === sq(sl)));
  const extra = userKey.filter((ul) => !solKey.some((sl) => sl === ul || sq(sl) === sq(ul)));
  const coverage = Math.round(((solKey.length - missing.length) / Math.max(solKey.length, 1)) * 100);
  return { match: missing.length === 0 && extra.length === 0, coverage, missing, extra };
}

// ── Format ───────────────────────────────────────────────────────────────────
/** Light formatter, same approach as the desktop Format button (no Monaco here). */
export function formatCode(code: string, lang: string): string {
  if (lang === 'python') {
    const lines = code.split('\n').map((l) => l.replace(/\t/g, '    ').replace(/\s+$/, ''));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }
  // C / Java / JavaScript: re-indent by brace depth with 4 spaces.
  let depth = 0;
  const out: string[] = [];
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    if (!line) { out.push(''); continue; }
    // Ignore braces inside strings/comments for the depth count.
    const bare = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '').replace(/\/\/.*$/, '');
    const opens = (bare.match(/\{/g) || []).length;
    const closes = (bare.match(/\}/g) || []).length;
    const lead = bare.trimStart().startsWith('}') ? 1 : 0;
    const indent = Math.max(0, depth - lead);
    out.push('    '.repeat(indent) + line);
    depth = Math.max(0, depth + opens - closes);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export const camelFileName = (title: string): string => {
  const words = (title || 'solution').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'solution';
  return words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))).join('');
};
