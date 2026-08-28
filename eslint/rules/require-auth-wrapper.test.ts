import { RuleTester } from 'eslint';
import tseslint from '@typescript-eslint/parser';
import rule from './require-auth-wrapper.mjs';

const projectScopedFile = 'app/api/projects/[id]/benefits/route.ts';
const portfolioFile = 'app/api/portfolio/report/route.ts';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
});

ruleTester.run('require-auth-wrapper', rule, {
  valid: [
    {
      code: 'export const GET = withProjectAccess(async () => {});',
      filename: projectScopedFile,
    },
    {
      code: 'export const GET = withProjectAccess<RouteParams>(async () => {});',
      filename: projectScopedFile,
    },
    {
      code: 'export async function GET() {}',
      filename: portfolioFile,
    },
  ],
  invalid: [
    {
      code: 'export async function GET() {}',
      filename: projectScopedFile,
      errors: [{ messageId: 'unwrapped' }],
    },
  ],
});
