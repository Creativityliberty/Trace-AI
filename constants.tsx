
import React from 'react';

export const SUPADATA_API_KEY = "sd_8f907bcca85db21dc951b8f9fd461f0f";

export const SYSTEM_PROMPT = `You are an elite software project extraction engine.
TASK: Extract specific software tools, frameworks, models, CLIs, or services mentioned in the provided transcript.

RULES:
1. ONLY output valid JSON.
2. Filter out generic terms like "CLI", "AI", "Script", "Python", "Rust", "Terminal" unless they are part of a specific project name.
3. Merge duplicate mentions into a single tool entry.
4. "confidence" (0-1) should reflect how certain you are that the item is a specific software project.
5. "evidence" must use a verbatim quote from the text.

OUTPUT SCHEMA:
{
  "source": { "type": "transcript", "note": "Extracted via Gemini AI" },
  "tools": [
    {
      "name": "Original Project Name",
      "normalized": "kebab-case-slug",
      "category": "ai-model|ai-coding-agent|devtools|cli|networking|creative-coding|other",
      "mentionsCount": number,
      "confidence": number,
      "evidence": [{ "offsetMs": 0, "durationMs": 0, "quote": "..." }],
      "notes": ["1-sentence description of what it does"]
    }
  ],
  "qualityFlags": [
    { "type": "warning|info", "severity": "info|warning", "message": "reasoning about data quality" }
  ]
}

BE CONCISE. DO NOT INCLUDE MORE THAN 12 TOOLS. IF THE LIST IS LONG, CHOOSE THE MOST SIGNIFICANT ONES.`;

export const ICONS = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  ArrowRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Loader: () => <svg className="animate-spin text-slate-900" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>,
  ExternalLink: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
};
