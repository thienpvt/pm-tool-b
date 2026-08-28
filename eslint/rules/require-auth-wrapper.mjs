import { ESLintUtils } from '@typescript-eslint/utils';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const allowlist = new Set(require('../route-wrapper-allowlist.json'));

const WRAPPERS = new Set([
  'withAuth',
  'withProjectAccess',
  'withProgramAccess',
  'withCpmo',
  'withRole',
]);

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/your-org/pm-tool-b/blob/master/eslint/rules/${name}.mjs`,
);

function toRelativePosix(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const cwd = process.cwd().replace(/\\/g, '/');
  if (normalized.startsWith(`${cwd}/`)) {
    return normalized.slice(cwd.length + 1);
  }
  return normalized.replace(/^\.\//, '');
}

function isProjectScoped(filename) {
  const posix = filename.replace(/\\/g, '/');
  if (posix.includes('/projects/[id]/')) return true;
  if (posix.includes('/programs/[id]/')) return true;
  if (posix.includes('/export/') && posix.includes('/[id]/')) return true;
  if (posix.includes('/import/resource-plan/[id]/')) return true;
  return false;
}

function isSanctionedWrapperCall(init) {
  if (!init || init.type !== 'CallExpression') return false;

  const { callee } = init;
  if (callee.type === 'Identifier') {
    return WRAPPERS.has(callee.name);
  }
  if (callee.type === 'TSInstantiationExpression' && callee.expression.type === 'Identifier') {
    return WRAPPERS.has(callee.expression.name);
  }
  return false;
}

const rule = createRule({
  name: 'require-auth-wrapper',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require project-scoped route.ts HTTP handlers to use sanctioned auth wrappers',
    },
    schema: [],
    messages: {
      unwrapped:
        'Project-scoped route handler must be wrapped with withAuth, withProjectAccess, withProgramAccess, withCpmo, or withRole',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const relativePosix = toRelativePosix(filename);

    if (!isProjectScoped(relativePosix)) {
      return {};
    }
    if (allowlist.has(relativePosix)) {
      return {};
    }

    function reportUnwrapped(node) {
      context.report({ node, messageId: 'unwrapped' });
    }

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'FunctionDeclaration') {
          const { id } = node.declaration;
          if (id?.type === 'Identifier' && METHODS.has(id.name)) {
            reportUnwrapped(node.declaration);
          }
          return;
        }

        if (node.declaration?.type !== 'VariableDeclaration') return;

        for (const decl of node.declaration.declarations) {
          if (decl.id.type !== 'Identifier' || !METHODS.has(decl.id.name)) continue;
          if (!isSanctionedWrapperCall(decl.init)) {
            reportUnwrapped(decl);
          }
        }
      },
    };
  },
});

export default rule;
