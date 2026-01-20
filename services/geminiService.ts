
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { TranscriptChunk, ExtractionResult } from "../types";

/**
 * Extracts tech tools using Gemini-3-pro-preview with Google Search Grounding.
 */
export const extractToolsWithAI = async (chunks: TranscriptChunk[]): Promise<ExtractionResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key configuration missing. Check environment injection.");

  const ai = new GoogleGenAI({ apiKey });
  
  // Truncate transcript to prevent token limits (500 chunks ~ 5-10k tokens)
  const transcriptText = Array.isArray(chunks) 
    ? chunks.slice(0, 500).map((c, i) => `[${i}] ${c.text || ''}`).join(' ')
    : '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: `Process this transcript and extract technical tools/projects. Verify URLs via Google Search tool. Transcript data: ${transcriptText}` }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        temperature: 0.15, // Low temperature for high precision JSON extraction
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Neural Engine connectivity active but response text empty.");
    
    // Safety parsing: identify JSON boundaries
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      console.error("AI returned malformed structured data:", rawText);
      throw new Error("Neural Engine failed to synchronize JSON output structure.");
    }
    
    const cleanJson = rawText.substring(start, end + 1);
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("JSON Syntax Error:", cleanJson);
      throw new Error("Extraction protocol corrupted: Malformed JSON syntax.");
    }
    
    // Schema normalization
    if (!parsed.tools || !Array.isArray(parsed.tools)) {
      parsed.tools = [];
    }
    
    // Grounding extraction - strictly following API rules
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    let groundingUrls: string[] = [];
    
    if (Array.isArray(groundingChunks)) {
      groundingUrls = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: any): uri is string => 
          typeof uri === 'string' && 
          uri.length > 0 && 
          (uri.startsWith('http://') || uri.startsWith('https://'))
        );
    }

    return {
      ...parsed,
      id: "pending", // To be finalized by caller
      timestamp: Date.now(),
      groundingUrls,
      stats: parsed.stats || { 
        totalTools: parsed.tools.length, 
        processingTimeMs: 0 
      }
    };
  } catch (e: any) {
    console.error("Global Extraction Exception", e);
    if (e.message?.includes("block")) throw new Error("Safety filters prevented neural signal processing.");
    throw e;
  }
};

/**
 * Generates visual metaphors for tools using gemini-2.5-flash-image.
 */
export const generateToolVisual = async (toolName: string, category: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ 
          text: `Professional high-end 3D abstract isometric product icon for a software project named "${toolName || 'Technology'}" in category "${category || 'General'}". Aesthetic: Minimalist, sleek, silver and midnight blue, glass textures, soft volumetric light, white clean studio background, 8k resolution.` 
        }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    // Traverse candidates defensively
    const candidates = response.candidates || [];
    for (const cand of candidates) {
      const parts = cand.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.warn(`Visual Synthesis Skipped: ${toolName}`, e);
  }
  return undefined;
};
