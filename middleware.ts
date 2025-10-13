import { NextRequest, NextResponse } from 'next/server'
// import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
// import { supabaseServiceRoleClient } from '@/lib/supabaseServiceClient'

export const config = {
  matcher: ['/dashboard/:path*', '/shifts/:path*', '/operators', '/admin'],
  runtime: 'nodejs', // ✅ Force Node.js runtime (fixes cookie parse issue)
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // TODO: Temporarily disabled authentication - database was deleted
  // Uncomment and reconfigure when new Supabase project is set up
  
  /*
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect unauthenticated users to /login
  if (!session && !req.nextUrl.pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // Protect admin-only routes
  const adminRoutes = ['/shifts/add', '/shifts/edit', '/operators', '/admin']

  if (session) {
    const userId = session.user.id

    // Get the role from Supabase user metadata
    const { data: user } = await supabaseServiceRoleClient
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    const role = user?.role || 'OPER'

    if (adminRoutes.some((path) => req.nextUrl.pathname.startsWith(path))) {
      if (role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }
  }
  */

  return res
}
