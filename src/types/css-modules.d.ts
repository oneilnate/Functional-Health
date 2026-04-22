/**
 * CSS module type declarations.
 * Required for TypeScript to understand CSS Module imports (*.module.css).
 */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
