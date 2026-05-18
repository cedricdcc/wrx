export * from './wrx.ts';
export { runWrxCli } from './src/cli/run.ts';

if (import.meta.main) {
  const { runWrxCli } = await import('./src/cli/run.ts');
  await runWrxCli();
}