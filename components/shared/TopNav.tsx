// ============================================
// Mobile-friendly Top Navigation
// components/shared/TopNav.tsx
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { logout } from '@/lib/supabase/client';
import Image from 'next/image';
import { FiMenu, FiX } from 'react-icons/fi';

interface TopNavProps {
  title?: string;
  userName?: string | null;
  links?: { label: string; href: string }[];
}

export function TopNav({ title = 'Vayro', userName, links = [] }: TopNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // even if logout fails server-side, still clear the client and redirect
    }
    toast.success('Logged out');
    router.push('/login');
  };

  return (
    <header className="bg-vayroCard border-b border-vayroBorder shadow-sm sticky top-0 z-20">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-9 h-9">
            <Image src="/logo.jpg" alt={title} fill className="object-contain" />
          </div>
          <span className="text-lg font-bold text-vayroGold">{title}</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-gray-300 hover:text-vayroGold">
              {link.label}
            </a>
          ))}
          {userName && <span className="text-sm text-gray-400">Hi, {userName}</span>}
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-red-500 hover:text-red-400"
          >
            Log out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-2xl text-vayroGold"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-vayroBorder bg-vayroCard px-4 py-3 space-y-3">
          {userName && <p className="text-sm text-gray-400">Hi, {userName}</p>}
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-gray-300 py-1"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left text-sm font-semibold text-red-500 py-1"
          >
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
