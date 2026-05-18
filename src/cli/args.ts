import type { ParsedCliArgs } from '../core/types';

const USAGE = `Usage: bun run wrx.js [options] <URI>

Options:
  -h, --help           Show this help message
  --all                Explore all extraction strategies
  --extend-links       Print modeled link relations
  --profile            Print discovered profile URIs
  -o, --output <path>  Write extracted RDF to a file

Examples:
  bun run wrx.js https://example.org/dataset
  bun run wrx.js --all --output output.ttl https://example.org/dataset
`;

export function getCliUsage(): string {
  return USAGE;
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  let all = false;
  let extendLinks = false;
  let help = false;
  let output: string | undefined;
  let profile = false;
  let input: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--all') {
      all = true;
      continue;
    }
    if (arg === '--extend-links') {
      extendLinks = true;
      continue;
    }
    if (arg === '--profile') {
      profile = true;
      continue;
    }
    if (arg === '--output' || arg === '-o') {
      const next = args[index + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('Missing value for --output');
      }
      output = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (!input) {
      input = arg;
      continue;
    }
    throw new Error(`Unexpected extra positional argument: ${arg}`);
  }

  return { all, extendLinks, help, input, output, profile };
}