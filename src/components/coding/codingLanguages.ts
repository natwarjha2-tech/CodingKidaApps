/**
 * Coding editor languages + starter code — identical to the desktop editor
 * (codingkidadesktop/src/renderer/coding-editor.js CODING_LANGUAGES /
 * getDefaultStarter) so a student sees the same thing on every device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CodingLangId = 'java' | 'c' | 'python' | 'javascript';

export interface CodingLanguage {
  id: CodingLangId;
  label: string;
  /** CodeMirror 5 mode (clike covers Java + C). */
  cmMode: string;
  /** Judge0 language id — what the backend expects. */
  judge0Id: number;
  extension: string;
  icon: string;
}

export const CODING_LANGUAGES: CodingLanguage[] = [
  { id: 'java', label: 'Java', cmMode: 'text/x-java', judge0Id: 62, extension: '.java', icon: '☕' },
  { id: 'c', label: 'C', cmMode: 'text/x-csrc', judge0Id: 50, extension: '.c', icon: '🇨' },
  { id: 'python', label: 'Python', cmMode: 'python', judge0Id: 71, extension: '.py', icon: '🐍' },
  { id: 'javascript', label: 'JavaScript', cmMode: 'javascript', judge0Id: 63, extension: '.js', icon: '🟨' },
];

export const getLanguage = (id?: string | null): CodingLanguage =>
  CODING_LANGUAGES.find((l) => l.id === id) || CODING_LANGUAGES[0];

const STARTERS: Record<CodingLangId, string> = {
  c: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main() {\n    // Read input\n    \n    // Write your solution here\n    \n    return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n        // Read input\n        \n        // Write your solution here\n        \n        sc.close();\n    }\n}\n',
  python: '# Read input\n\n# Write your solution here\n\n',
  javascript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nconst lines = [];\nrl.on("line", (line) => lines.push(line.trim()));\nrl.on("close", () => {\n    // Read input from lines[]\n    \n    // Write your solution here\n    \n});\n',
};

export const getDefaultStarter = (id: string): string =>
  (STARTERS as Record<string, string>)[id] || '// Write your code here\n';

/** True if `code` is empty or exactly one of the default starters. */
export const isDefaultOrEmpty = (code: string): boolean => {
  const c = code.trim();
  return !c || CODING_LANGUAGES.some((l) => c === getDefaultStarter(l.id).trim());
};

// ── Per-user, per-exercise, per-language auto-save (desktop key format) ──────
// AsyncStorage, not SecureStore: SecureStore values are limited to ~2 KB.
const codeKey = (userId: string | undefined, exerciseId: string, lang: string) =>
  `ck_code_${userId || 'anon'}_${exerciseId}_${lang}`;

export async function loadSavedCode(userId: string | undefined, exerciseId: string, lang: string): Promise<string | null> {
  if (!exerciseId) return null;
  try {
    return (await AsyncStorage.getItem(codeKey(userId, exerciseId, lang))) || null;
  } catch {
    return null;
  }
}

export async function saveCode(userId: string | undefined, exerciseId: string, lang: string, code: string): Promise<void> {
  if (!exerciseId) return;
  try {
    await AsyncStorage.setItem(codeKey(userId, exerciseId, lang), code);
  } catch { /* storage full — non-fatal */ }
}

// Editor look (same preference name as desktop's code editor theme).
export const THEME_KEY = 'ck_ce_theme';
export const FONT_KEY = 'ck_ce_font';
