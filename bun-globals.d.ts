// Type declarations for Bun-specific globals not covered by standard DOM/ESNext libs.
// These are provided at runtime by Bun (https://bun.sh).

declare global {
  interface ImportMeta {
    /** True when the current module is the entry point (i.e. run directly). */
    main: boolean;
  }

  // Bun exposes a Node.js-compatible `process` global.
  var process: {
    argv: string[];
    exit(code?: number): never;
  };
}

export {};
