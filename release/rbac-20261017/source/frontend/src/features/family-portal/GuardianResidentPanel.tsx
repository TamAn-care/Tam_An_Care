import { useQuery } from '@tanstack/react-query';
import { listGuardianResidents } from '../../api/guardian-residents';
import type { HumanActorSession } from '../../types/actor';
import { EmptyState, ErrorState, LoadingState } from '../../components/feedback/FeedbackStates';

export function GuardianResidentPanel({ actor }: { actor: HumanActorSession }) {
  const residents = useQuery({
    queryKey: ['guardian-residents', actor.actorId],
    queryFn: () => listGuardianResidents(actor),
    staleTime: 0,
    refetchInterval: 30000,
  });
  if (residents.isPending) return <LoadingState title="Đang tải hồ sơ được liên kết" />;
  if (residents.isError) return <ErrorState title="Không thể tải hồ sơ" description="Vui lòng kiểm tra phiên đăng nhập và quyền liên kết." />;
  if (!residents.data.length) return <EmptyState title="Chưa có hồ sơ được liên kết" description="Vui lòng liên hệ cơ sở để kiểm tra quyền người bảo hộ." />;
  return <section>
    <h2>Hồ sơ người thân</h2>
    {residents.data.map(resident => <article className="card" key={resident.residentId}>
      <h3>{resident.displayName}</h3>
      <p>Mã cư dân: {resident.residentCode}</p>
      <p>Phòng: {resident.room || 'Chưa bố trí'}</p>
    </article>)}
  </section>;
}
