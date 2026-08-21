import { createFileRoute } from '@tanstack/react-router';
import TravelerDevWorkspace from '../components/traveler-dev/TravelerDevWorkspace';

function TravelerDevRoute() {
  return <TravelerDevWorkspace />;
}

export const Route = createFileRoute('/traveler-dev')({
  component: TravelerDevRoute,
});
