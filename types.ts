
export interface TranscriptChunk {
  text: string;
  offset: number;
  duration: number;
  lang: string;
}

export interface ToolMention {
  name: string;
  normalized: string;
  category: string;
  mentionsCount: number;
  confidence: number;
  officialUrl?: string;
  aiThumbnail?: string; // Base64 image data
  evidence: {
    offsetMs: number | null;
    durationMs: number | null;
    quote: string;
    chunkIndexes: number[];
  }[];
  notes: string[];
}

export interface ExtractionResult {
  source: {
    type: string;
    note: string;
  };
  tools: ToolMention[];
  groundingUrls?: string[];
  qualityFlags: {
    type: string;
    severity: "info" | "warning" | "error";
    message: string;
    items: string[];
  }[];
}

export enum AnalysisStep {
  IDLE = 'IDLE',
  FETCHING_TRANSCRIPT = 'FETCHING_TRANSCRIPT',
  TRANSCRIPT_PROCESSING = 'TRANSCRIPT_PROCESSING',
  AI_EXTRACTION = 'AI_EXTRACTION',
  AI_VISUAL_GEN = 'AI_VISUAL_GEN',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}
