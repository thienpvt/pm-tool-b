import { NextRequest, NextResponse } from 'next/server';
import { REQUEST_ID_HEADER, logRequest, newRequestId } from '@/lib/log';

const PUBLIC = ['/login', '/landing', '/api/auth/', '/api/health', '/api/demo-requests'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get('pm_session');

  // Log backend calls only. The matcher also covers pages and RSC payload
  // requests; logging those would bury the API lines in noise.
  const isApi = pathname.startsWith('/api/');
  const id = newRequestId();
  if (isApi) logRequest(id, req.method, pathname, !!session?.value);

  // Stamp the id onto the *request* so handlers and instrumentation.ts can
  // correlate their own lines with the [req] line above. Per the proxy docs
  // this must be `next({ request: { headers } })` — `next({ headers })` would
  // expose it to the client instead of upstream.
  const withId = () => {
    if (!isApi) return NextResponse.next();
    const headers = new Headers(req.headers);
    headers.set(REQUEST_ID_HEADER, id);
    return NextResponse.next({ request: { headers } });
  };

  if (PUBLIC.some(p => pathname.startsWith(p))) return withId();

  if (!session?.value) {
    if (pathname === '/') return NextResponse.redirect(new URL('/landing', req.url));
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL('/login', req.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return withId();
}

export const config = {
  // Static assets under public/ must be excluded too. Without the extension
  // group, a request for /shb-logo.svg has no session cookie and gets
  // redirected to /login — the browser then receives an HTML page where an
  // image should be and renders a broken-image icon.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot)$).*)',
  ],
};
