import { ArrowRight, Code2, Sparkles } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

export default function TravelerDevLauncher() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/traveler-dev' })}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
        <Code2 size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          Traveler.dev
          <Sparkles size={13} className="text-violet-300" />
        </span>

        <span className="block truncate text-xs text-slate-500">
          AI application & website workspace
        </span>
      </span>

      <ArrowRight
        size={15}
        className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300"
      />
    </button>
  );
}
