/**
 * Global test setup for vitest-native.
 * MSW server lifecycle is managed per-test file via beforeAll/afterAll.
 */

// Polyfill fetch if not available (Node 22 has it natively)
// MSW v2 uses native fetch; no explicit polyfill needed on Node 22.

