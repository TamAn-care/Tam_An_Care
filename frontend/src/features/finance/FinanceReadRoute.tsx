import { useActor } from '../../auth/ActorContext';
import FinanceReadPage from './FinanceReadPage';

/**
 * Authenticated Finance read entry.
 * Server-side authorization remains mandatory.
 */
export default function FinanceReadRoute() {
  const { actor } = useActor();
  if (!actor) return null;
  return <FinanceReadPage options={{ actor }} />;
}
