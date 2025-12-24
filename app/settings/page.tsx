'use client'
import { useRouter } from 'next/navigation';

// COMPONENTS
import BottomNav from '@/components/BottomNav';
import SettingsScreen from '@/components/SettingsScreen';

export default function SettingsPage() {
  const router = useRouter();

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* MAIN CONTENT */}
      <main className="pb-24 sm:pb-28">
        <SettingsScreen onNavigate={handleNavigation} />
      </main>

      {/* FOOTER */}
      <BottomNav />
    </div>
  );
}
