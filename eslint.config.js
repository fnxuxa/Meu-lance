import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...ts.configs.recommended],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
);
