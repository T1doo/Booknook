import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AuthGate } from '@/components/layout/auth-gate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-background animate-fade-in">
            <div className="p-6 max-w-[1600px] mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
