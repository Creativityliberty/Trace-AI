
import React, { useState } from 'react';
import { AnalysisStep, ToolMention, ExtractionResult } from './types';
import { ICONS } from './constants';
import { fetchTranscript, pollJobStatus } from './services/supadataService';
import { extractToolsWithAI, generateToolVisual } from './services/geminiService';

const ToolCard: React.FC<{ tool: ToolMention; index: number }> = ({ tool, index }) => {
  return (
    <div 
      className="mizu-card flex flex-col h-full group animate-reveal border-0 overflow-hidden bg-white"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="h-48 w-full bg-[#0a0f1d] relative overflow-hidden">
        {tool.aiThumbnail ? (
          <img src={tool.aiThumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-80" alt={tool.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <ICONS.Loader />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        <div className="absolute top-6 left-6 flex gap-2">
          <span className="text-[9px] font-black px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 uppercase tracking-[0.2em]">
            {tool.category}
          </span>
          {tool.githubUrl && (
            <span className="text-[9px] font-black px-3 py-1 rounded-full bg-slate-900 text-white border border-slate-700 uppercase tracking-[0.2em] flex items-center gap-1">
              <ICONS.Github /> Repo Found
            </span>
          )}
        </div>
      </div>

      <div className="px-10 pb-10 flex-1 flex flex-col">
        <h3 className="text-3xl font-extrabold text-[#0a0f1d] mb-2 tracking-tighter outfit leading-none">
          {tool.name}
        </h3>
        <p className="text-sm text-slate-400 font-bold mb-6 outfit tracking-tight">Verified Technology</p>
        
        <p className="text-base text-slate-500 font-medium mb-8 leading-relaxed line-clamp-2">
          {tool.notes?.[0]}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[20px] font-black text-[#0a0f1d] leading-none outfit">{tool.mentionsCount}</span>
            <span className="text-[9px] uppercase text-slate-300 tracking-[0.2em] font-black">Occurrences</span>
          </div>
          
          <div className="flex gap-3">
            {tool.githubUrl && (
              <a 
                href={tool.githubUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                title="GitHub Repository"
              >
                <ICONS.Github />
              </a>
            )}
            <a 
              href={tool.officialUrl || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-12 h-12 bg-[#0a0f1d] rounded-xl flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-lg"
              title="Official Link"
            >
              <ICONS.ExternalLink />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<AnalysisStep>(AnalysisStep.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url) return;
    const vid = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sanday\?v=))([\w\-]{11})/)?.[1];
    if (!vid) { setError("Lien invalide"); return; }

    setError(null);
    setVideoId(vid);
    setExtraction(null);
    setStep(AnalysisStep.FETCHING_TRANSCRIPT);

    try {
      const startTime = Date.now();
      const transcript = await fetchTranscript(url);
      
      // Attempt to extract video metadata from transcript service if available
      const videoMeta = transcript.metadata || { title: "Analyzed Session", author: "YouTube Creator" };

      setStep(AnalysisStep.AI_EXTRACTION);
      const res = await extractToolsWithAI(Array.isArray(transcript.content) ? transcript.content : (transcript.transcript || []));
      
      setStep(AnalysisStep.AI_VISUAL_GEN);
      const toolsWithVisuals = await Promise.all(res.tools.map(async (tool) => {
        const visual = await generateToolVisual(tool.name, tool.category);
        return { ...tool, aiThumbnail: visual };
      }));
      
      setExtraction({ 
        ...res, 
        tools: toolsWithVisuals,
        video: {
          title: videoMeta.title,
          author: videoMeta.author,
          thumbnailUrl: `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`
        },
        stats: {
          totalTools: res.tools.length,
          processingTimeMs: Date.now() - startTime
        }
      });
      setStep(AnalysisStep.COMPLETED);
    } catch (err: any) {
      setError(err.message);
      setStep(AnalysisStep.FAILED);
    }
  };

  const exportToJson = () => {
    if (!extraction) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extraction, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `mizu_extract_${videoId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen pb-32">
      <nav className="mizu-glass px-12 py-8 flex justify-between items-center fixed top-0 w-full z-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0a0f1d] flex items-center justify-center shadow-xl">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <span className="text-2xl font-black text-[#0a0f1d] outfit tracking-tighter">mizu.elite</span>
        </div>
        <div className="flex items-center gap-6">
          {extraction && (
            <button 
              onClick={exportToJson}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ICONS.FileJson /> Export JSON
            </button>
          )}
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 animate-pulse hidden md:block">
            Grounded Protocol v2.5
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-12 pt-48">
        {!extraction && step === AnalysisStep.IDLE && (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-20">
            <div className="lg:w-1/2 animate-reveal">
              <h1 className="text-8xl md:text-[11rem] font-black text-[#0a0f1d] leading-[0.8] mb-12 tracking-tighter outfit">
                Visual <br/><span className="text-slate-200">Stack.</span>
              </h1>
              <p className="text-xl text-slate-400 max-w-lg font-medium leading-relaxed mb-16">
                Le premier moteur d'extraction de stack technologique boosté par l'IA générative et la recherche GitHub en temps réel.
              </p>
              <div className="relative group max-w-xl">
                <input 
                  type="text" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="URL YouTube..." 
                  className="w-full py-7 px-10 text-xl font-bold rounded-[2rem] border border-slate-100 bg-white shadow-2xl outline-none focus:border-slate-900 transition-all"
                />
                <button onClick={handleAnalyze} className="absolute right-3 top-3 bottom-3 bg-[#0a0f1d] text-white px-10 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all">
                  START SCAN
                </button>
              </div>
            </div>
            <div className="lg:w-1/3 relative hidden lg:block">
               <div className="w-full aspect-[3/4] bg-white rounded-[4rem] shadow-2xl border-[16px] border-white overflow-hidden animate-reveal">
                  <img src="https://images.unsplash.com/photo-1635339001026-6114ad43a0d3?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover grayscale" alt="HUD" />
                  <div className="absolute inset-0 bg-blue-600/10 mix-blend-overlay"></div>
               </div>
            </div>
          </div>
        )}

        {step !== AnalysisStep.IDLE && step !== AnalysisStep.COMPLETED && step !== AnalysisStep.FAILED && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-32 h-32 rounded-[2.5rem] bg-white shadow-2xl flex items-center justify-center mb-12 animate-bounce">
              <ICONS.Loader />
            </div>
            <h2 className="text-4xl font-black outfit tracking-tighter mb-4">
              {step === AnalysisStep.AI_VISUAL_GEN ? "Synthèse Visuelle IA..." : "Recherche GitHub & Grounding..."}
            </h2>
            <div className="w-64 h-1 bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-[#0a0f1d] animate-[loading_2s_infinite]"></div>
            </div>
          </div>
        )}

        {extraction && (
          <div className="animate-reveal">
            {/* Video Header Detail */}
            <div className="mb-24 flex flex-col md:flex-row gap-12 items-end">
              <div className="w-full md:w-80 h-48 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white relative shrink-0">
                <img src={extraction.video?.thumbnailUrl} className="w-full h-full object-cover" alt="Video" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d]/60 to-transparent"></div>
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500 mb-6 block">Intelligence Exposée</span>
                <h2 className="text-5xl md:text-7xl font-black text-[#0a0f1d] tracking-tighter outfit leading-none mb-6">
                  {extraction.video?.title}
                </h2>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-black text-[#0a0f1d] outfit">{extraction.video?.author}</span>
                    <span className="text-[9px] uppercase text-slate-400 tracking-widest font-black">Creator</span>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-black text-[#0a0f1d] outfit">{extraction.stats.totalTools} Project(s)</span>
                    <span className="text-[9px] uppercase text-slate-400 tracking-widest font-black">Extracted</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              {extraction.tools.map((tool, idx) => (
                <ToolCard key={idx} tool={tool} index={idx} />
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes loading {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 100%; transform: translateX(0%); }
          100% { width: 0%; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
