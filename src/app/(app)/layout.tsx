import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { NotificationsProvider } from '@/hooks/useNotifications';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NotificationsProvider>
        <AppShell>{children}</AppShell>
      </NotificationsProvider>
    </AuthGate>
  );
}
