'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, usePathname } from 'next/navigation'

const navItems = {
    ADMIN: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Operators', href: '/operators' },
        { name: 'Assign Shifts', href: '/shifts' },
        { name: 'Fatigue Policy', href: '/fatigue' },
    ],
    OPER: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Operators', href: '/operators' },
        { name: 'My Info', href: '/operators/me' },
        { name: 'My Calendar', href: '/calendar' },
    ],
}

export default function SidebarNav() {
    const [role, setRole] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const fetchRoleFromDB = async () => {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            )

            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) {
                // On non-auth pages, bounce to login; otherwise, let auth pages render
                if (!pathname?.startsWith('/auth')) router.push('/auth/login')
                return
            }

            setUserEmail(session.user.email || null)

            // Expect a profile row with role for the auth user, else default OPER
            const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', session.user.id)
                .single()

            setRole((profile as any)?.role || 'OPER')
        }

        fetchRoleFromDB()
    }, [router, pathname])

    const handleLogout = async () => {
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    // Hide sidebar entirely on auth pages
    if (pathname?.startsWith('/auth')) {
        return null
    }


    if (!role) {
        return (
            <aside className="w-64 bg-black text-white p-4 min-h-screen">
                <p className="text-gray-400">Loading...</p>
            </aside>
        )
    }

    return (
        <aside className="w-64 bg-black text-white p-4 min-h-screen flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <Image src="/p66-logo.svg" alt="Phillips 66" width={36} height={36} className="w-9 h-9" />
                <h2 className="text-lg font-semibold">Refinery Scheduler</h2>
            </div>
            <nav className="flex flex-col space-y-2 flex-1">
                {navItems[role as 'ADMIN' | 'OPER'].map((item) => (
                    <Link
                        key={item.name}
                        href={item.href}
                        className="hover:bg-red-700 px-3 py-2 rounded transition"
                    >
                        {item.name}
                    </Link>
                ))}
            </nav>

            {/* User info and logout at bottom */}
            <div className="mt-auto pt-4 border-t border-gray-700">
                {userEmail && (
                    <div className="mb-3 px-3 py-2">
                        <p className="text-xs text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium truncate">{userEmail}</p>
                        <p className="text-xs text-gray-400 mt-1">Role: {role}</p>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log Out
                </button>
            </div>
        </aside>
    )
}

