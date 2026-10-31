import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />

      {/* Mobile admin bar with hamburger */}
      <div className="sticky top-[64px] z-30 border-b border-line bg-white px-4 py-2 md:hidden">
        <button
          aria-label="Open admin menu"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="container-page flex flex-1 gap-6 py-5 sm:py-8 pb-24 md:pb-8">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
