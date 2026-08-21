import { useState } from "react";
import {
  Bot,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  Folder,
  Globe,
  Hammer,
  Loader2,
  Play,
  Rocket,
  Send,
  Smartphone,
  Terminal,
  TestTube2,
  XCircle,
} from "lucide-react";

import {
  buildAndroid,
  buildWorkspace,
  publishWebsite,
  runAgent,
  testWorkspace,
} from "../../lib/traveler-workspace";

type EventItem = {
  type: "info" | "success" | "error";
  text: string;
};

type Artifact = {
  type?: string;
  url?: string;
  download_url?: string;
  install_url?: string;
  name?: string;
};

function eventClass(type: EventItem["type"]) {
  if (type === "success") return "text-emerald-300";
  if (type === "error") return "text-red-300";
  return "text-slate-300";
}

export default function TravelerDevWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [mode, setMode] = useState<"app" | "website">("app");

  const log = (type: EventItem["type"], text: string) => {
    setEvents((current) => [...current, { type, text }]);
  };

  const execute = async () => {
    const query = prompt.trim();

    if (!query || busy) return;

    setBusy(true);
    setArtifact(null);
    setEvents([]);

    try {
      log("info", "Starting Traveler Dev agent.");

      const agentResult = await runAgent({
        prompt: query,
        intent: "agent",
        project: "Traveler.dev",
        mode,
      });

      log("success", "Agent planning completed.");

      const buildResult = await buildWorkspace({
        prompt: query,
        project: "Traveler.dev",
        mode,
        agent: agentResult,
      });

      log("success", "Workspace build completed.");

      const testResult = await testWorkspace({
        project: "Traveler.dev",
        mode,
        build: buildResult,
      });

      log("success", "Workspace tests completed.");

      if (mode === "website") {
        const published = await publishWebsite({
          project: "Traveler.dev",
          build: buildResult,
          test: testResult,
        });

        const result =
          typeof published === "object" && published !== null
            ? (published as Artifact)
            : null;

        setArtifact(result);
        log("success", "Website published successfully.");
      } else {
        const built = await buildAndroid({
          project: "Traveler.dev",
          build: buildResult,
          test: testResult,
        });

        const result =
          typeof built === "object" && built !== null
            ? (built as Artifact)
            : null;

        setArtifact(result);
        log("success", "Application artifact generated.");
      }
    } catch (error) {
      log(
        "error",
        error instanceof Error ? error.message : "Workflow failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-white/10 bg-white/[0.025] p-4 lg:block">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
              <Code2 size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">Traveler.dev</div>
              <div className="text-xs text-slate-500">Workspace</div>
            </div>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-2">
              <Bot size={16} />
              Agent
            </div>

            <div className="flex items-center gap-3 px-3 py-2 text-slate-400">
              <Folder size={16} />
              Files
            </div>

            <div className="flex items-center gap-3 px-3 py-2 text-slate-400">
              <Terminal size={16} />
              Terminal
            </div>

            <div className="flex items-center gap-3 px-3 py-2 text-slate-400">
              <TestTube2 size={16} />
              Tests
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Traveler.dev</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">Workspace</span>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Render backend
            </div>
          </header>

          <section className="flex-1 overflow-auto px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-5xl">
              <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight">
                  What do you want to build?
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Traveler Dev plans, builds, tests and delivers the project
                  through the production backend.
                </p>
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("app")}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    mode === "app"
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-white/[0.03] text-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Smartphone size={15} />
                    Application
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("website")}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    mode === "website"
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-white/[0.03] text-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe size={15} />
                    Website
                  </span>
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-1 shadow-2xl backdrop-blur-xl">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.ctrlKey || event.metaKey)
                    ) {
                      event.preventDefault();
                      void execute();
                    }
                  }}
                  placeholder={
                    mode === "app"
                      ? "Build a production Android application..."
                      : "Build a production website..."
                  }
                  className="min-h-44 w-full resize-none rounded-xl border-0 bg-transparent p-5 text-sm outline-none placeholder:text-slate-600"
                />

                <div className="flex items-center justify-between border-t border-white/10 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Code2 size={14} />
                    Groq → Cerebras
                  </div>

                  <button
                    type="button"
                    disabled={busy || !prompt.trim()}
                    onClick={() => void execute()}
                    className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={15} />
                    ) : (
                      <Send size={15} />
                    )}
                    Build
                  </button>
                </div>
              </div>

              {(events.length > 0 || artifact) && (
                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                      <Terminal size={16} />
                      Execution
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      {events.map((event, index) => (
                        <div
                          key={`${event.text}-${index}`}
                          className={`flex gap-3 ${eventClass(event.type)}`}
                        >
                          {event.type === "success" ? (
                            <CheckCircle2 size={15} />
                          ) : event.type === "error" ? (
                            <XCircle size={15} />
                          ) : (
                            <Play size={15} />
                          )}
                          <span>{event.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {artifact && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
                        {mode === "website" ? (
                          <Rocket size={16} />
                        ) : (
                          <Hammer size={16} />
                        )}
                        Delivery
                      </div>

                      <div className="mb-5 text-xs text-slate-500">
                        {artifact.name ||
                          (mode === "website"
                            ? "Published website"
                            : "Application artifact")}
                      </div>

                      {(artifact.download_url || artifact.url) && (
                        <a
                          href={artifact.download_url || artifact.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                        >
                          {mode === "website" ? (
                            <>
                              <ExternalLink size={15} />
                              Open published website
                            </>
                          ) : (
                            <>
                              <Download size={15} />
                              Download application
                            </>
                          )}
                        </a>
                      )}

                      {artifact.install_url && (
                        <a
                          href={artifact.install_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm"
                        >
                          <Download size={15} />
                          Install
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
