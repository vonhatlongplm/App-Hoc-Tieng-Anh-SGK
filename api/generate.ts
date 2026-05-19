import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL } from "../constants";

let genAI: GoogleGenerativeAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    genAI = new GoogleGenerativeAI(key.trim());
  }
  return genAI;
};

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
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: systemInstruction ? String(systemInstruction).substring(0, 10000) : undefined
    });

    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ] as any;

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

    const result = await model.generateContent({ 
      contents: finalContents,
      safetySettings
    });

    const response = await result.response;
    const candidate = response.candidates?.[0];
    
    if (candidate?.finishReason === 'SAFETY') {
        return res.status(200).json({ text: "⚠️ Nội dung bị chặn bởi bộ lọc an toàn. Vui lòng thử lại." });
    }

    let text = "";
    try {
      text = response.text();
    } catch (e) {
      text = candidate?.finishReason ? `Lỗi AI (Lý do: ${candidate.finishReason})` : "Gia sư không thể phản hồi.";
    }

    if (!text) {
      return res.status(200).json({ text: "Gia sư không thể phản hồi lúc này. (Empty response)" });
    }

    res.status(200).json({ text });
  } catch (err: any) {
    console.error("Vercel Generate Error:", err);
    const errorMsg = err.response?.data?.error?.message || err.response?.error?.message || err.message || "Generation failed";
    res.status(500).json({ 
      error: errorMsg,
      details: err.stack || ""
    });
  }
}
