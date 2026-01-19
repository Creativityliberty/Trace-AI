
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { TranscriptChunk, ExtractionResult, ToolMention } from "../types";

export const extractToolsWithAI = async (chunks: TranscriptChunk[]): Promise<ExtractionResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey });
  const transcriptText = chunks.map((c, i) => `[${i}] ${c.text}`).join(' ');

  // STEP 1: Extraction avec Search Grounding
  const textResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Extract tech tools from this transcript and verify their official websites using search. Transcript: ${transcriptText}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    }
  });

  const text = textResponse.text;
  if (!text) throw new Error("Extraction failed");
  
  const result: ExtractionResult = JSON.parse(text);
  
  // Collect grounding links
  const groundingChunks = textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    result.groundingUrls = groundingChunks.map((c: any) => c.web?.uri).filter(Boolean);
  }

  return result;
};

export const generateToolVisual = async (toolName: string, category: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A high-end, minimalist 3D tech abstract icon for a software named "${toolName}" in the category "${category}". Professional, sleek, midnight blue and silver palette, studio lighting, 8k resolution, macro photography style.` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation failed for", toolName, e);
  }
  return undefined;
};
