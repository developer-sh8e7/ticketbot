import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/DashboardShell';
import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { sessionIsOwner } from '@/lib/owner';
import { getSession } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export default async function OwnerProjectsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!sessionIsOwner(session)) redirect('/dashboard');

  return (
    <DashboardShell title="مشروعك" subtitle="طلبات المشاريع والمحادثات المشفّرة مع العملاء." badge="مالك المتجر">
      <ProjectRequestsClient ownerMode />
    </DashboardShell>
  );
}
