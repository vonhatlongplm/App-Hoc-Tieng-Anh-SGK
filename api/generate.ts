import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL } from "../constants";

let genAI: any = null;

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    genAI = new GoogleGenAI({
      apiKey: key.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: false,
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
    
    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: "Invalid contents format" });
    }

    const ai = getGenAI();
    console.log(`Using Antigravity SDK with model: ${GEMINI_MODEL}`);
    
    const finalContents = contents.map((c: any) => ({
      role: c.role === 'model' ? 'model' : 'user',
      parts: (c.parts || []).filter((p: any) => (p.text && String(p.text).trim()) || p.inlineData || p.fileData).map((p: any) => {
        if (p.text !== undefined) return { text: String(p.text).trim() };
        if (p.inlineData) return { inlineData: p.inlineData };
        if (p.fileData) return { fileData: p.fileData };
        return p;
      })
    })).filter((c: any) => c.parts && c.parts.length > 0);

    if (finalContents.length === 0) {
      return res.status(400).json({ error: "No valid content to send to Gemini" });
    }

    const response = await ai.models.generateContent({ 
      model: GEMINI_MODEL,
      contents: finalContents,
      config: {
        systemInstruction: systemInstruction ? String(systemInstruction).substring(0, 8000) : undefined,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
        ]
      }
    });

    const candidate = response.candidates?.[0];
    
    if (candidate?.finishReason === 'SAFETY') {
        return res.status(200).json({ text: "⚠️ Nội dung bị chặn bởi bộ lọc an toàn. Vui lòng thử lại." });
    }

    const text = response.text;

    if (!text) {
      return res.status(200).json({ text: "Gia sư không thể phản hồi lúc này. (Empty response)" });
    }

    res.status(200).json({ text });
    } catch (err: any) {
      console.error("Vercel Generate Error [Antigravity SDK]:", err);
      const errorMsg = err.message || "Generation failed";
      res.status(500).json({ 
        error: `[Antigravity SDK] ${errorMsg}`,
        details: err.stack || ""
      });
    }
}
