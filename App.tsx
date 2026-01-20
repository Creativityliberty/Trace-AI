
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnalysisStep, ToolMention, ExtractionResult, ViewState } from './types';
import { ICONS } from './constants';
import { fetchTranscript } from './services/supadataService';
import { extractToolsWithAI, generateToolVisual } from './services/geminiService';

/**
 * Safely extracts hostname from a URL string.
 * Prevents "Uncaught" errors from invalid URL formats.
 */
const getSafeHostname = (url: any): string => {
  if (typeof url !== 'string' || !url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname || url;
  } catch {
    return url;
  }
};

const ToolCard: React.FC<{ tool: ToolMention; index: number }> = ({ tool, index }) => {
  if (!tool) return null;

  return (
    <div 
      className="mizu-card flex flex-col h-full group animate-reveal border-0 overflow-hidden bg-white shadow-sm"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-48 w-full bg-[#0a0f1d] relative overflow-hidden">
        {tool.aiThumbnail ? (
          <img 
            src={tool.aiThumbnail} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms] opacity-90" 
            alt={tool.name || 'Tool'} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-[#0a0f1d]">
            <div className="opacity-10 scale-150 rotate-12"><ICONS.Github /></div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        <div className="absolute top-6 left-6 flex gap-2">
          <span className="text-[9px] font-black px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-xl text-white border border-white/30 uppercase tracking-[0.2em] shadow-lg">
            {tool.category || 'Tech'}
          </span>
        </div>
      </div>

      <div className="px-8 pb-10 flex-1 flex flex-col relative">
        <div className="absolute -top-6 right-8 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center group-hover:-translate-y-2 transition-transform duration-500">
           <span className="text-xl font-black text-[#0a0f1d] outfit leading-none">{index + 1}</span>
        </div>

        <h3 className="text-2xl font-extrabold text-[#0a0f1d] mb-1 tracking-tighter outfit leading-none pt-4">
          {tool.name || 'Unnamed Node'}
        </h3>
        <p className="text-[10px] text-slate-300 font-bold mb-5 outfit tracking-widest uppercase">Validated node</p>
        
        <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed line-clamp-3">
          {tool.notes?.[0] || "No technical description available for this neural node."}
        </p>

        <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[20px] font-black text-[#0a0f1d] leading-none outfit">{tool.mentionsCount || 0}</span>
            <span className="text-[8px] uppercase text-slate-300 tracking-[0.2em] font-black mt-1">Occurrences</span>
          </div>
          
          <div className="flex gap-3">
            {tool.githubUrl && (
              <a 
                href={tool.githubUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-11 h-11 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all duration-300 transform hover:rotate-6 shadow-sm"
              >
                <ICONS.Github />
              </a>
            )}
            <a 
              href={tool.officialUrl || tool.githubUrl || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-11 h-11 bg-[#0a0f1d] rounded-2xl flex items-center justify-center text-white hover:bg-blue-600 transition-all duration-300 transform hover:-rotate-6 shadow-md"
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
  const [activeView, setActiveView] = useState<ViewState>('SCAN');
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<AnalysisStep>(AnalysisStep.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [currentExtraction, setCurrentExtraction] = useState<ExtractionResult | null>(null);
  const [archive, setArchive] = useState<ExtractionResult[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Load Archive - Initial Sync with heavy error guarding
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mizu_archive');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Additional integrity check for archive items
          const validated = parsed.filter(item => item && item.id && Array.isArray(item.tools));
          setArchive(validated);
        }
      }
    } catch (e) {
      console.error("Critical: Archive sync failed during load", e);
    }
  }, []);

  // Save Archive - Sync with defensive stringification
  useEffect(() => {
    if (archive && archive.length >= 0) {
      try {
        localStorage.setItem('mizu_archive', JSON.stringify(archive));
      } catch (e) {
        console.error("Critical: Archive sync failed during save", e);
      }
    }
  }, [archive]);

  const handleAnalyze = useCallback(async () => {
    if (!url || step !== AnalysisStep.IDLE) return;
    
    // YouTube ID Extraction Pattern
    const vidMatch = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/sanday\?v=))([\w\-]{11})/);
    const vid = vidMatch?.[1];
    if (!vid) { 
      setError("Neutral Link Protocol Mismatch: Invalid YouTube URL."); 
      return; 
    }

    setError(null);
    setCurrentExtraction(null);
    setStep(AnalysisStep.FETCHING_TRANSCRIPT);

    try {
      const startTime = Date.now();
      const transcriptData = await fetchTranscript(url);
      
      // Ensure transcriptData is defined and has expected structure
      if (!transcriptData) throw new Error("Data retrieval resulted in null response.");
      
      const transcriptContent = Array.isArray(transcriptData.content) 
        ? transcriptData.content 
        : (transcriptData.transcript || []);

      if (transcriptContent.length === 0) {
        throw new Error("Neural signal empty: No transcript detected for this source.");
      }

      setStep(AnalysisStep.AI_EXTRACTION);
      const extractionRes = await extractToolsWithAI(transcriptContent);
      
      if (!extractionRes || !extractionRes.tools) {
        throw new Error("Neural Engine failed to return structured tools.");
      }
      
      setStep(AnalysisStep.AI_VISUAL_GEN);
      const videoMeta = transcriptData.metadata || { title: "Trace Session", author: "Verified Source" };
      
      // Concurrency-friendly visual generation
      const toolsWithVisuals = await Promise.all((extractionRes.tools || []).map(async (tool) => {
        try {
          if (!tool || !tool.name) return tool;
          const visual = await generateToolVisual(tool.name, tool.category || 'technology');
          return { ...tool, aiThumbnail: visual };
        } catch (visErr) {
          console.warn("Visual Synthesis Exception", visErr);
          return tool;
        }
      }));
      
      const completeResult: ExtractionResult = { 
        ...extractionRes, 
        id: vid,
        tools: toolsWithVisuals,
        timestamp: Date.now(),
        video: {
          title: videoMeta.title || "Untitled Session",
          author: videoMeta.author || "Unknown Creator",
          thumbnailUrl: videoMeta.thumbnailUrl || `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`
        },
        stats: {
          totalTools: toolsWithVisuals.length,
          processingTimeMs: Date.now() - startTime
        }
      };

      setCurrentExtraction(completeResult);
      setArchive(prev => {
        const history = Array.isArray(prev) ? prev : [];
        const filtered = history.filter(a => a && a.id !== vid);
        return [completeResult, ...filtered];
      });
      setStep(AnalysisStep.COMPLETED);
    } catch (err: any) {
      console.error("Trace Logic Failure", err);
      setError(err.message || "A neural processing error occurred. System reset suggested.");
      setStep(AnalysisStep.FAILED);
    }
  }, [url, step]);

  const deleteFromArchive = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Purge this trace from the archives? Action irreversible.")) {
      setArchive(prev => (Array.isArray(prev) ? prev.filter(a => a && a.id !== id) : []));
    }
  }, []);

  // Dashboard Aggregation Logic - Fully Guarded
  const stats = useMemo(() => {
    // Explicitly typed empty returns to ensure consistency
    if (!Array.isArray(archive)) return { totalUniqueTools: 0, categories: {} as Record<string, number>, mostMentioned: [] as ToolMention[] };

    const allTools = archive.filter(Boolean).flatMap(a => (Array.isArray(a.tools) ? a.tools : []));
    const catMap: Record<string, number> = {};
    const uniqueMap = new Map<string, ToolMention>();

    allTools.forEach(t => {
      if (!t) return;
      const cat = t.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + 1;

      const norm = t.normalized || (t.name ? t.name.toLowerCase().replace(/\s+/g, '-') : 'unknown');
      const existing = uniqueMap.get(norm);
      if (!existing || (existing.mentionsCount || 0) < (t.mentionsCount || 0)) {
        uniqueMap.set(norm, t);
      }
    });

    const uniqueToolsList = Array.from(uniqueMap.values());
    const mostMentioned = [...uniqueToolsList]
      .sort((a, b) => (Number(b.mentionsCount) || 0) - (Number(a.mentionsCount) || 0))
      .slice(0, 5);

    return { 
      totalUniqueTools: Number(uniqueToolsList.length) || 0, 
      categories: catMap, 
      mostMentioned 
    };
  }, [archive]);

  const filteredArchive = useMemo(() => {
    if (!Array.isArray(archive)) return [];
    if (!selectedTag) return archive.filter(Boolean);
    return archive.filter(a => a && Array.isArray(a.tools) && a.tools.some(t => t && t.category === selectedTag));
  }, [archive, selectedTag]);

  return (
    <div className="min-h-screen bg-[#f5f5f3] selection:bg-[#0a0f1d] selection:text-white">
      {/* Navbar Implementation */}
      <nav className="mizu-glass px-6 md:px-12 py-6 flex flex-col md:flex-row gap-6 justify-between items-center fixed top-0 w-full z-50">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => { setActiveView('SCAN'); setCurrentExtraction(null); setError(null); setStep(AnalysisStep.IDLE); setUrl(''); }}
        >
          <div className="w-10 h-10 rounded-2xl bg-[#0a0f1d] flex items-center justify-center shadow-xl group-hover:rotate-[15deg] transition-transform duration-500">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <span className="text-2xl font-black text-[#0a0f1d] outfit tracking-tighter">mizu.elite</span>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 bg-white/50 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-white/50 shadow-sm overflow-x-auto max-w-full no-scrollbar">
          {(['SCAN', 'LIBRARY', 'DASHBOARD'] as ViewState[]).map(v => (
            <button 
              key={v}
              onClick={() => { setActiveView(v); setError(null); }}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all duration-500 whitespace-nowrap ${activeView === v ? 'bg-[#0a0f1d] text-white shadow-lg translate-y-[-2px]' : 'text-slate-400 hover:text-[#0a0f1d]'}`}
            >
              {v === 'SCAN' && <ICONS.Search />}
              {v === 'LIBRARY' && <ICONS.FileJson />}
              {v === 'DASHBOARD' && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
              {v.toLowerCase()}
            </button>
          ))}
        </div>
        
        <div className="hidden md:flex items-center gap-4">
           {archive.length > 0 && (
             <button 
                onClick={() => {
                  try {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(archive, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute("href", dataStr);
                    dl.setAttribute("download", `mizu_backup_${new Date().toISOString().split('T')[0]}.json`);
                    dl.click();
                  } catch (err) {
                    console.error("Backup export failed", err);
                  }
                }} 
                className="px-6 py-2 bg-white/80 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0a0f1d] hover:bg-white transition-all duration-300 border border-slate-100 shadow-sm"
              >
               Backup Vault
             </button>
           )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-56 pb-32">
        {/* VIEW: SCANNER */}
        {activeView === 'SCAN' && (
          <div className="animate-reveal">
            {!currentExtraction && step === AnalysisStep.IDLE && (
              <div className="flex flex-col lg:flex-row items-center justify-between gap-16 md:gap-24">
                <div className="lg:w-3/5">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 mb-8">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Neural Engine Active</span>
                  </div>
                  <h1 className="text-7xl md:text-[9rem] lg:text-[11rem] font-black text-[#0a0f1d] leading-[0.8] mb-12 tracking-tighter outfit">
                    Trace <br/><span className="text-slate-200">Neural.</span>
                  </h1>
                  <p className="text-xl md:text-2xl text-slate-400 max-w-xl font-medium leading-relaxed mb-16">
                    Moteur d'extraction d'élite. Identifiez les outils technologiques, visualisez les stacks et archivez l'intelligence logicielle.
                  </p>
                  
                  <div className="relative group max-w-2xl">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[3rem] blur opacity-10 group-focus-within:opacity-20 transition duration-1000"></div>
                    <input 
                      type="text" 
                      value={url} 
                      onChange={e => setUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                      placeholder="Collez une URL YouTube..." 
                      className="relative w-full py-8 md:py-9 px-10 md:px-12 text-xl md:text-2xl font-bold rounded-[3rem] border border-slate-200 bg-white shadow-2xl outline-none focus:border-[#0a0f1d] transition-all duration-500"
                    />
                    <button 
                      onClick={handleAnalyze} 
                      disabled={!url || step !== AnalysisStep.IDLE}
                      className="absolute right-4 top-4 bottom-4 bg-[#0a0f1d] text-white px-10 md:px-14 rounded-[2.2rem] font-black text-xs md:text-sm hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed group-hover:bg-blue-600"
                    >
                      INITIALIZE SCAN
                    </button>
                  </div>
                  {error && (
                    <div className="mt-8 flex items-center gap-3 p-5 bg-red-50 border border-red-100 rounded-3xl animate-reveal">
                       <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                       <p className="text-red-500 text-sm font-bold uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                </div>
                
                <div className="lg:w-2/5 relative hidden lg:block group">
                   <div className="absolute -inset-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                   <div className="w-full aspect-[4/5] bg-[#0a0f1d] rounded-[5rem] shadow-[0_50px_100px_-20px_rgba(10,15,29,0.3)] p-14 flex flex-col justify-end text-white overflow-hidden relative">
                      <div className="absolute top-20 right-20 flex gap-4">
                         <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                         <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                         <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="relative z-10">
                        <span className="text-[11px] font-black uppercase tracking-[0.5em] text-blue-400 mb-6 block">Vault Index</span>
                        <div className="text-8xl font-black outfit mb-4 translate-x-[-4px]">{archive?.length || 0}</div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                          Sessions indexées <br/>dans la banque Mizu.
                        </div>
                      </div>
                      <div className="absolute bottom-40 left-14 opacity-10 font-mono text-[10px] space-y-1">
                         <div className="text-blue-400">{'const engine = new MizuScanner();'}</div>
                         <div className="text-purple-400">{'await engine.extract({ vid: \'neural\' });'}</div>
                         <div className="text-green-400">{'console.log(\'Success\');'}</div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {(step !== AnalysisStep.IDLE && step !== AnalysisStep.COMPLETED && step !== AnalysisStep.FAILED) && (
              <div className="flex flex-col items-center justify-center py-32 md:py-48 text-center animate-reveal">
                <div className="relative mb-16">
                  <div className="absolute inset-0 bg-blue-500 rounded-[4rem] blur-[40px] opacity-20 animate-pulse"></div>
                  <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-[3.5rem] bg-white shadow-2xl flex items-center justify-center border-[12px] border-white">
                    <ICONS.Loader />
                  </div>
                </div>
                <h2 className="text-4xl md:text-6xl font-black outfit tracking-tighter mb-6">Traitement Neural...</h2>
                <div className="flex items-center gap-6">
                   <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-blue-500 animate-[loading_1.5s_infinite]"></div>
                   </div>
                   <p className="text-slate-400 uppercase text-[11px] tracking-[0.4em] font-black">{step.replace(/_/g, ' ')}</p>
                   <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 bg-blue-500 animate-[loading_1.5s_infinite_reverse]"></div>
                   </div>
                </div>
              </div>
            )}

            {currentExtraction && (
              <div className="animate-reveal">
                <div className="mb-20 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10">
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
                    <div className="relative group shrink-0">
                      <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition"></div>
                      <div className="relative w-56 h-32 md:w-72 md:h-40 rounded-[2rem] overflow-hidden shadow-2xl border-[6px] border-white">
                        <img 
                          src={currentExtraction.video?.thumbnailUrl || `https://img.youtube.com/vi/${currentExtraction.id}/maxresdefault.jpg`} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                          alt="Video" 
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'; }}
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center pl-1 shadow-lg">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-4xl md:text-5xl font-black text-[#0a0f1d] tracking-tighter outfit leading-tight max-w-2xl">{currentExtraction.video?.title || "Session Analysis"}</h2>
                      <div className="flex items-center gap-4 mt-6">
                        <div className="px-4 py-1.5 rounded-full bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {currentExtraction.video?.author || "Verified Creator"}
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <div className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">{currentExtraction.tools?.length || 0} Nodes extraits</div>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setCurrentExtraction(null); setStep(AnalysisStep.IDLE); setUrl(''); }} 
                    className="group px-10 py-5 bg-white rounded-3xl text-[11px] font-black uppercase tracking-widest text-[#0a0f1d] shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all border border-slate-50 flex items-center gap-4"
                  >
                    <span>Fermer la session</span>
                    <span className="w-5 h-5 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-[#0a0f1d] group-hover:text-white transition-colors">×</span>
                  </button>
                </div>

                {currentExtraction.groundingUrls && currentExtraction.groundingUrls.length > 0 && (
                  <div className="mb-16 p-10 bg-white/60 backdrop-blur-xl rounded-[3rem] border border-white shadow-sm animate-reveal">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>
                       </div>
                       <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-[#0a0f1d]">Vérification Neuronale (Search Grounding)</h4>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {currentExtraction.groundingUrls.map((u, i) => (
                        <a 
                          key={i} 
                          href={u} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="px-6 py-3 bg-white/80 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-white hover:shadow-md transition-all border border-slate-100 flex items-center gap-3"
                        >
                          <ICONS.ExternalLink />
                          <span className="truncate max-w-[200px]">{getSafeHostname(u)}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {currentExtraction.tools?.map((tool, idx) => (
                    <ToolCard key={idx} tool={tool} index={idx} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: LIBRARY */}
        {activeView === 'LIBRARY' && (
          <div className="animate-reveal">
            <header className="mb-16 md:mb-24 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
              <div>
                <h2 className="text-6xl md:text-8xl font-black text-[#0a0f1d] tracking-tighter outfit leading-none mb-10">Vault <br/><span className="text-slate-200">Archives.</span></h2>
                <div className="flex gap-3 flex-wrap">
                  <button 
                    onClick={() => setSelectedTag(null)}
                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all duration-500 ${!selectedTag ? 'bg-[#0a0f1d] text-white border-[#0a0f1d] shadow-xl translate-y-[-2px]' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}
                  >
                    Toutes
                  </button>
                  {Object.keys(stats?.categories || {}).sort().map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedTag(cat)}
                      className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all duration-500 ${selectedTag === cat ? 'bg-blue-600 text-white border-blue-600 shadow-xl translate-y-[-2px]' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-left md:text-right bg-white px-10 py-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-w-[240px]">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 block mb-3">Total Vault Depth</span>
                <span className="text-5xl font-black text-[#0a0f1d] outfit">{filteredArchive?.length || 0}</span>
                <div className="mt-4 flex gap-1">
                   {filteredArchive.slice(0, 5).map((_, i) => <div key={i} className="h-1 flex-1 bg-slate-100 rounded-full"></div>)}
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredArchive.map((res, idx) => (
                <div 
                  key={res.id} 
                  onClick={() => { setCurrentExtraction(res); setActiveView('SCAN'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="bg-white rounded-[3rem] p-8 md:p-10 flex flex-col sm:flex-row items-center gap-10 cursor-pointer hover:shadow-[0_40px_80px_-20px_rgba(10,15,29,0.08)] transition-all duration-500 border border-transparent hover:border-slate-100 group relative overflow-hidden"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <button 
                    onClick={(e) => deleteFromArchive(res.id, e)}
                    className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center hover:bg-red-500 hover:text-white shadow-sm z-10"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                  </button>
                  
                  <div className="w-full sm:w-48 h-32 rounded-[1.8rem] overflow-hidden shrink-0 shadow-lg relative group-hover:scale-105 transition-transform duration-700">
                    <img 
                      src={res.video?.thumbnailUrl || `https://img.youtube.com/vi/${res.id}/maxresdefault.jpg`} 
                      className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                      alt="Video" 
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0 py-2">
                    <h3 className="text-2xl font-black text-[#0a0f1d] outfit truncate mb-3 group-hover:text-blue-600 transition-colors">{res.video?.title || "Trace Node"}</h3>
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="px-3 py-1 bg-slate-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {res.timestamp ? new Date(res.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                        {res.tools?.length || 0} PROJETS INDEXÉS
                      </div>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-[#0a0f1d] group-hover:text-white group-hover:rotate-[360deg] transition-all duration-1000 shrink-0 shadow-sm">
                    <ICONS.ExternalLink />
                  </div>
                </div>
              ))}
              {filteredArchive?.length === 0 && (
                <div className="col-span-full py-32 text-center animate-reveal">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
                    <div className="w-10 h-10 border-2 border-slate-100 rounded-xl"></div>
                  </div>
                  <p className="text-slate-300 font-bold outfit text-3xl uppercase tracking-tighter">Le coffre est vide.</p>
                  <button 
                    onClick={() => setActiveView('SCAN')}
                    className="mt-8 px-10 py-4 bg-[#0a0f1d] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale(1.05) transition-transform"
                  >
                    Lancer un Scan
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {activeView === 'DASHBOARD' && (
          <div className="animate-reveal">
            <h2 className="text-6xl md:text-8xl font-black text-[#0a0f1d] tracking-tighter outfit leading-none mb-20 md:mb-28">Insights <br/><span className="text-slate-200">Intelligence.</span></h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-20">
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 block mb-8">Noyaux Uniques</span>
                <div className="text-7xl md:text-8xl font-black text-[#0a0f1d] outfit leading-none">{stats?.totalUniqueTools || 0}</div>
                <div className="mt-10 h-3 w-full bg-slate-50 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-[#0a0f1d] transition-all duration-[2000ms] ease-out" 
                    style={{ width: `${Math.min(100, (Number(stats?.totalUniqueTools || 0) / 50) * 100)}%` }}
                   ></div>
                </div>
                <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacité de stockage: 50 nodes</p>
              </div>
              
              <div className="bg-white p-12 rounded-[4rem] shadow-sm md:col-span-2 border border-slate-50 group">
                <span className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 block mb-12">Densité par Catégorie</span>
                <div className="flex items-end gap-4 md:gap-8 h-48 md:h-56">
                   {Object.entries(stats?.categories || {}).length > 0 ? Object.entries(stats.categories).sort((a,b) => Number(b[1]) - Number(a[1])).map(([cat, count]) => (
                     <div key={cat} className="flex-1 flex flex-col items-center gap-6 group/bar">
                        <div 
                          className="w-full bg-slate-50 rounded-2xl group-hover/bar:bg-[#0a0f1d] transition-all duration-700 relative shadow-inner" 
                          // Fix: Use explicit Number casting for both operands of the arithmetic division to satisfy TypeScript strict requirements
                          style={{ height: `${(Number(count) / Math.max(1, Number(stats?.totalUniqueTools || 0))) * 100}%`, minHeight: '12px' }}
                        >
                           <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[12px] font-black text-[#0a0f1d] opacity-0 group-hover/bar:opacity-100 group-hover/bar:-translate-y-2 transition-all duration-500 bg-white px-3 py-1 rounded-lg shadow-xl border border-slate-100 z-10">{count}</div>
                        </div>
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 truncate w-full text-center group-hover/bar:text-[#0a0f1d] transition-colors">{cat}</span>
                     </div>
                   )) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-slate-200 font-black uppercase tracking-[0.3em] text-xs">Waiting for Neural Input...</p>
                    </div>
                   )}
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f1d] p-12 md:p-20 rounded-[5rem] text-white relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[loading_4s_infinite]"></div>
               <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600 rounded-full blur-[200px] opacity-10"></div>
               
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-8">
                 <h3 className="text-4xl md:text-5xl font-black outfit tracking-tighter">Top Neural Discoveries</h3>
                 <div className="px-6 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 backdrop-blur-md border border-white/10">
                    Live Ranking
                 </div>
               </div>

               <div className="space-y-8 relative z-10">
                  {stats.mostMentioned.length > 0 ? stats.mostMentioned.map((tool, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/5 pb-8 last:border-0 group/item">
                       <div className="flex items-center gap-10">
                          <span className="text-3xl font-black text-white/10 outfit group-hover/item:text-blue-500/40 transition-colors duration-500">0{i+1}</span>
                          <div>
                            <div className="text-2xl md:text-3xl font-black outfit mb-2 group-hover/item:translate-x-2 transition-transform duration-500">{tool.name || 'Unnamed Project'}</div>
                            <div className="inline-block px-3 py-1 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 group-hover/item:bg-blue-500 group-hover/item:text-white transition-all">{tool.category || 'Tech'}</div>
                          </div>
                       </div>
                       <div className="text-right">
                          <div className="text-3xl font-black outfit text-blue-400 group-hover/item:scale-110 transition-transform duration-500">{tool.mentionsCount || 0}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Total Mentions</div>
                       </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-[3rem]">
                      <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">Le dashboard analytique nécessite des scans pour générer des métriques.</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-12 py-20 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
         <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-xl bg-slate-200"></div>
           <span className="text-sm font-black text-slate-300 outfit uppercase tracking-widest">Mizu Neural Extraction System v2.5</span>
         </div>
         <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
           &copy; {new Date().getFullYear()} Elite Intelligence Engine. All Rights Reserved.
         </div>
      </footer>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
