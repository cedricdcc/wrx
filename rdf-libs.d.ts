declare module 'n3' {
  export const DataFactory: any;
  export class Parser {
    constructor(options?: any);
    parse(input: string, callback: (error: unknown, quad?: any) => void): void;
  }
  export class Writer {
    constructor(options?: any);
    addQuads(quads: any[]): void;
    end(callback: (error: unknown, result?: string) => void): void;
  }
}

declare module 'jsonld' {
  const jsonld: any;
  export default jsonld;
}
