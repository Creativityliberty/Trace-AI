
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";
import { TranscriptChunk, ExtractionResult, ChatMessage } from "../types";

export const extractToolsWithAI = async (chunks: TranscriptChunk[]): Promise<ExtractionResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Clé API manquante dans l'environnement.");

  const ai = new GoogleGenAI({ apiKey });
  
  const transcriptWithTime = Array.isArray(chunks) 
    ? chunks.slice(0, 500).map((c, i) => `[${Math.floor(c.offset || 0)}s] ${c.text || ''}`).join(' ')
    : '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: `Analysez ce transcript. Extrayez les outils techniques avec leurs timestamps. Vérifiez les URLs via l'outil Google Search. Transcript: ${transcriptWithTime}` }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        temperature: 0.15,
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Le moteur neural n'a retourné aucun texte.");
    
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1) throw new Error("Format JSON non détecté dans la réponse IA.");
    
    const cleanJson = rawText.substring(start, end + 1);
    const parsed = JSON.parse(cleanJson);
    
    if (!parsed.tools) parsed.tools = [];
    
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    let groundingUrls: string[] = [];
    
    if (Array.isArray(groundingChunks)) {
      groundingUrls = groundingChunks
        .map((chunk: any) => chunk.web?.uri)
        .filter((uri: any): uri is string => typeof uri === 'string');
    }

    return {
      ...parsed,
      id: "pending",
      timestamp: Date.now(),
      groundingUrls,
      stats: parsed.stats || { totalTools: parsed.tools.length, processingTimeMs: 0 }
    };
  } catch (e: any) {
    console.error("Erreur Gemini (Extraction):", e);
    throw e;
  }
};

export const chatWithStack = async (history: ChatMessage[], stack: ExtractionResult): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Clé API manquante.");
  
  const ai = new GoogleGenAI({ apiKey });
  const stackSummary = (stack.tools || []).map(t => `- ${t.name} (${t.category}): ${t.notes?.[0] || ''}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      { role: 'user', parts: [{ text: `Vous êtes un assistant neural pour la stack technique suivante extraite d'une vidéo :\n${stackSummary}\n\nQuestion de l'utilisateur : ${history[history.length - 1].text}` }] }
    ],
    config: {
      systemInstruction: "Soyez concis, professionnel et utile. Concentrez-vous uniquement sur les outils fournis dans la stack, sauf demande contraire.",
      temperature: 0.7
    }
  });

  return response.text || "Je suis désolé, mes circuits neuraux sont un peu flous pour le moment.";
};

export const generateToolVisual = async (toolName: string, category: string): Promise<string | undefined> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return undefined;
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Professional 3D isometric icon for "${toolName}" in category "${category}". Aesthetic: sleek, silver, glass, soft blue glow, white background.` }]
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    
    const candidates = response.candidates || [];
    for (const cand of candidates) {
      if (!cand.content || !cand.content.parts) continue;
      const parts = cand.content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) { 
    console.warn("Échec génération visuel pour:", toolName, e); 
  }
  return undefined;
};
