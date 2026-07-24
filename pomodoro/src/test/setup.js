// Global test setup — runs before every test file (see `test.setupFiles`).
//
// Importing the `/vitest` entry point registers the jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, ...) on Vitest's `expect`. This is the
// current, non-deprecated way to wire jest-dom into Vitest.
import '@testing-library/jest-dom/vitest';
