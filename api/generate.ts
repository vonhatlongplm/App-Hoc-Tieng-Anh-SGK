import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    genAI = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { contents, systemInstruction } = req.body;
    
    // Convert contents to match @google/genai expectations if needed
    // contents usually is [{ role: 'user', parts: [{ text: '...' }] }]
    
    const ai = getGenAI();
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
      }
    });

    res.status(200).json({ text: result.text });
  } catch (err: any) {
    console.error("Vercel Generate Error:", err);
    res.status(500).json({ error: err.message || "Generation failed" });
  }
}
