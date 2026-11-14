/**
 * Code execution API — same endpoints the desktop coding editor uses
 * (codingkidadesktop/src/renderer/coding-editor.js). Code runs on the SERVER
 * (Judge0/Piston), never on the phone.
 */
import { apiClient } from './client';

export type RunStatus =
  | 'accepted' | 'wrong_answer' | 'time_limit' | 'compilation_error'
  | 'runtime_error' | 'internal_error' | 'unknown' | string;

/** POST /api/code/run → raw program output for custom stdin. */
export interface CodeRunResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  status?: RunStatus;
  status_description?: string;
  time?: string | null;   // seconds, e.g. "0.012"
  memory?: number | null; // KB
  message?: string;
}

/** One test case in a submit result. Hidden cases come back as "(hidden)". */
export interface CodeTestCaseResult {
  test_case: number;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  status: RunStatus;
  time: string | null;
  memory: number | null;
  is_hidden: boolean;
}

/** POST /api/code/submit → evaluated against all (incl. hidden) test cases. */
export interface CodeSubmitResult {
  success: boolean;
  passed?: boolean;
  total_tests?: number;
  passed_tests?: number;
  results?: CodeTestCaseResult[];
  submission_id?: string;
  time?: string | null;   // e.g. "1.234s"
  memory?: string | null; // e.g. "12 MB"
  message?: string;
}

export interface SampleTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  order: number;
}

export interface CodeSubmission {
  id: string;
  language: string | null;
  passed: boolean;
  status: string | null;
  executionTime: number | null; // ms
  memoryUsed: number | null;    // KB
  createdAt: string;
}

// ── Standalone Code Editor (desktop "coding-playground") ─────────────────────
export interface PlaygroundTestCase { input: string; expectedOutput: string; isHidden?: boolean }

export interface PlaygroundProblem {
  id: string;
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  explanation?: string;
  category?: string;
  difficulty: string;
  defaultLanguage?: string;
  constraints?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  starterCode?: Record<string, string>;
  testCases?: PlaygroundTestCase[];
  hints?: string[];
  tags?: string[];
  /** Mobile-only: created by the student on this device ("My Problems"). */
  lockedLanguage?: boolean;
}

export interface LangSolution {
  code: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  tc?: string;
  sc?: string;
  explanation?: string;
}
/** Best solution: per-language blocks, or the old single-language shape. */
export type BestSolution = LangSolution & {
  language?: string;
  c?: LangSolution; java?: LangSolution; python?: LangSolution; javascript?: LangSolution;
};

export interface LeaderboardEntry { rank: number; name: string; coins: number; submittedAt?: string }

export const playgroundApi = {
  problems: () =>
    apiClient
      .get<{ success: boolean; problems: PlaygroundProblem[]; total?: number; categories?: string[] }>('/api/coding-problems', { timeout: 30000 })
      .then((r) => r.data),

  bestSolution: (problemId: string) =>
    apiClient
      // Generated on a cache miss, so it can be slow.
      .get<{ success: boolean; solution?: BestSolution }>(
        `/api/coding-problems/best-solution?problemId=${encodeURIComponent(problemId)}`,
        { timeout: 60000 }
      )
      .then((r) => r.data),

  analyzeComplexity: (body: { code: string; language: string }) =>
    apiClient
      .post<{ success?: boolean; timeComplexity?: string; spaceComplexity?: string }>('/api/code/analyze-complexity', body, { timeout: 30000 })
      .then((r) => r.data),

  compileCheck: (body: { source_code: string; language_id: number }) =>
    apiClient
      .post<{ success?: boolean; has_errors?: boolean; errors?: { line?: number; column?: number; message?: string; severity?: string }[] }>(
        '/api/code/compile-check', body, { timeout: 20000 }
      )
      .then((r) => r.data),

  scoreEarn: (body: { problemId: string; problemTitle: string; difficulty: string; points: number; coins: number }) =>
    apiClient.post('/api/coding-score/earn', body).then((r) => r.data),

  leaderboardPost: (body: { problemId: string; problemTitle: string; qualityTag: string; lessonId?: string; courseId?: string }) =>
    apiClient
      .post<{ success: boolean; rank?: number; coinsAwarded?: number; alreadyRanked?: boolean }>('/api/coding-problems/leaderboard', body)
      .then((r) => r.data),

  leaderboardGet: (problemId: string) =>
    apiClient
      .get<{ success: boolean; leaderboard?: LeaderboardEntry[]; totalParticipants?: number }>(
        `/api/coding-problems/leaderboard?problemId=${encodeURIComponent(problemId)}`
      )
      .then((r) => r.data),
};

export const codeApi = {
  run: (body: { source_code: string; language_id: number; stdin: string }) =>
    apiClient
      // A single compile + run can take several seconds on Java.
      .post<CodeRunResult>('/api/code/run', body, { timeout: 45000 })
      .then((r) => r.data),

  submit: (body: { exerciseId: string; source_code: string; language_id: number; courseId: string }) =>
    apiClient
      // Up to 20 test cases, 5 in parallel, each may take seconds → long timeout.
      .post<CodeSubmitResult>('/api/code/submit', body, { timeout: 120000 })
      .then((r) => r.data),

  /** Visible (non-hidden) sample test cases. Public endpoint. */
  testCases: (exerciseId: string) =>
    apiClient
      .get<{ success: boolean; testCases: SampleTestCase[] }>(
        `/api/exercise/test-cases?exerciseId=${encodeURIComponent(exerciseId)}`
      )
      .then((r) => r.data),

  /** The current user's last 10 submissions for an exercise. */
  submissions: (exerciseId: string) =>
    apiClient
      .get<{ success: boolean; submissions: CodeSubmission[] }>(
        `/api/code/submissions?exerciseId=${encodeURIComponent(exerciseId)}`
      )
      .then((r) => r.data),
};
