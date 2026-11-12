import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = request.nextUrl.pathname;

  // 1. Unauthenticated users trying to access protected routes
  if (!session && (path.startsWith('/super-admin') || path.startsWith('/tenant') || path.startsWith('/agent'))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Fetch user role and tenant info if logged in
  if (session) {
    const { data: userData } = await supabase
      .from('users')
      .select('role, tenant_id')
      .eq('id', session.user.id)
      .single();

    if (userData) {
      const { role } = userData;

      // Prevent non-super-admins from entering super-admin panel
      if (path.startsWith('/super-admin') && role !== 'super_admin') {
        return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
      }

      // Route agents directly to dialer if they try visiting admin pages
      if (path.startsWith('/tenant') && role === 'agent') {
        return NextResponse.redirect(new URL('/agent/dialer', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/super-admin/:path*', '/tenant/:path*', '/agent/:path*'],
};
