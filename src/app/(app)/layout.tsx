import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';
import { NotificationsProvider } from '@/hooks/useNotifications';
import { NativeBridge } from '@/components/NativeBridge';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NotificationsProvider>
        <NativeBridge />
        <AppShell>{children}</AppShell>
      </NotificationsProvider>
    </AuthGate>
  );
}
