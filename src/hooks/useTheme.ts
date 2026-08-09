// Re-export from the .tsx implementation so extension-agnostic imports (and any
// stale dev-cached reference to `useTheme.ts`) still resolve. Kept in sync with
// src/hooks/useTheme.tsx.
export { ThemeProvider, useTheme } from "./useTheme.tsx";