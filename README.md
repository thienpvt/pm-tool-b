This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing

```bash
npm test           # run everything once
npm run test:watch # watch mode
```

Vitest runs two projects from `vitest.config.ts`:

| Project | Files | Environment |
|---------|-------|-------------|
| `node`  | `{lib,app}/**/*.test.ts`  | node — unit tests, route-handler tests |
| `jsdom` | `{components,app}/**/*.test.tsx` | jsdom — React component tests |

Route handlers are tested by importing the exported handler and calling it with a
constructed `NextRequest` — no dev server required.

### Repository tests (real Postgres)

Repository tests skip unless `TEST_DATABASE_URL` is set. To run them locally:

```bash
docker run -d --name pm-tool-test-db -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pm_tool_test postgres:17

TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/pm_tool_test npm test
```

The database name **must** end in `_test` — `test/db.ts` refuses to connect otherwise,
so a stray production URL cannot be truncated by a test run.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
