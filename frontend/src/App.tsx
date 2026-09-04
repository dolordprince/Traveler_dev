import React, { useState } from 'react';
import { Terminal, Cpu, Database, Send, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'terminal'>('editor');

  const handleInterrogate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/agent/interrogate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      setHistory([data, ...history]);
      setPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <div className="w-16 bg-[#161b22] border-r border-slate-800 flex flex-col items-center py-4 space-y-6">
        <div className="p-2 bg-indigo-600 rounded-xl text-white font-bold tracking-tighter">TD</div>
        <button onClick={() => setActiveTab('editor')} className={`p-3 rounded-lg ${activeTab === 'editor' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}><Cpu size={20}/></button>
        <button onClick={() => setActiveTab('preview')} className={`p-3 rounded-lg ${activeTab === 'preview' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}><CheckCircle2 size={20}/></button>
        <button onClick={() => setActiveTab('terminal')} className={`p-3 rounded-lg ${activeTab === 'terminal' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}><Terminal size={20}/></button>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-800 bg-[#161b22] px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="font-semibold text-lg tracking-wide text-indigo-400">TRAVELER.DEV</h1>
            <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400">SQLite + FastAPI Engine Active</span>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Code/Workspace Panel */}
          <div className="flex-1 flex flex-col bg-[#0d1117] border-r border-slate-800">
            <div className="h-10 bg-[#161b22]/50 border-b border-slate-800 px-4 flex items-center text-xs text-slate-400 space-x-4">
              <span className="text-indigo-400 border-b-2 border-indigo-500 pb-2.5">App.tsx</span>
              <span>schema.sql</span>
              <span>requirements.txt</span>
            </div>
            
            <div className="flex-1 p-6 overflow-auto">
              <pre className="text-sm font-mono text-slate-300 bg-[#161b22] p-4 rounded-lg border border-slate-800">
{`import React from 'react';

export default function WorkspacePreview() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white">Build Amazing Apps with AI</h2>
      <p className="text-slate-400 mt-2">TRAVELER.DEV workspace is fully loaded and primed.</p>
    </div>
  );
}`}
              </pre>

              {/* Interrogation Terminal UI */}
              <div className="mt-6 bg-[#161b22] rounded-xl border border-slate-800 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Database size={16} className="text-indigo-400"/> SQLite Agent Interrogation Feed
                </h3>
                <form onSubmit={handleInterrogate} className="flex gap-2">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want to build or interrogate..."
                    className="flex-1 bg-[#0d1117] border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition">
                    {loading ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16}/>} Run
                  </button>
                </form>

                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {history.map((item, index) => (
                    <div key={index} className="p-3 bg-[#0d1117] rounded-lg border border-slate-800 text-xs">
                      <p className="text-indigo-300 font-semibold">Query: {item.query}</p>
                      <p className="text-slate-400 mt-1">Analysis: {item.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
