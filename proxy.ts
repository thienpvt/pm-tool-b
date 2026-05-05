import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login', '/api/auth/', '/api/health'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  const session = req.cookies.get('pm_session');
  if (!session?.value) {
    const url = new URL('/login', req.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
