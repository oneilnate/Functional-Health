/**
 * Secondary ESLint config for Expo-specific rules only.
 * Biome owns all base linting. This config adds Expo's multi-environment
 * rules (Metro Node.js context vs Hermes runtime context).
 *
 * Integrated into `pnpm lint` as a secondary check after Biome.
 */
import tsParser from '@typescript-eslint/parser';
import expoPlugin from 'eslint-plugin-expo';

export default [
  {
    plugins: {
      expo: expoPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'expo/no-dynamic-env-var': 'warn',
      'expo/no-env-var-destructuring': 'warn',
    },
    files: ['src/**/*.{ts,tsx}'],
  },
];
