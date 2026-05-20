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

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("Vercel Generate Error: GEMINI_API_KEY is missing");
      return res.status(401).json({ error: "[Omni-SDK-v3] GEMINI_API_KEY is missing. Vui lòng thêm biến này vào Settings > Environment Variables trên Vercel và Redeploy lại app." });
    }

    const ai = getGenAI();
    console.log(`[Omni-SDK-v3] Calling Gemini with model: ${GEMINI_MODEL}`);
    
    // Antigravity SDK contents mapping
    const finalContents = contents.map((c: any) => {
      const role = c.role === 'model' ? 'model' : 'user';
      const parts = (c.parts || []).filter((p: any) => 
        (p.text && String(p.text).trim()) || p.inlineData || p.fileData
      ).map((p: any) => {
        if (p.text !== undefined) return { text: String(p.text).trim() };
        if (p.inlineData) return { inlineData: p.inlineData };
        if (p.fileData) return { fileData: p.fileData };
        return p;
      });
      return { role, parts };
    }).filter((c: any) => c.parts && c.parts.length > 0);

    if (finalContents.length === 0) {
      return res.status(400).json({ error: "Không tìm thấy nội dung hợp lệ để gửi cho AI." });
    }

    try {
      // Use top-level systemInstruction with parts array (wire format compatibility)
      const response = await ai.models.generateContent({ 
        model: GEMINI_MODEL,
        contents: finalContents,
        systemInstruction: systemInstruction ? { parts: [{ text: String(systemInstruction).substring(0, 8000) }] } : undefined,
        config: {
          temperature: 0.7,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 2048,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ]
        }
      } as any);

      const text = response.text;
      if (!text) {
        return res.status(200).json({ text: "Gia sư không thể phản hồi lúc này. Vui lòng thử lại câu hỏi khác." });
      }

      res.status(200).json({ text });
    } catch (apiErr: any) {
      console.error("Gemini API Error Detail:", apiErr);
      // Specific check for systemInstruction error
      if (apiErr.message?.includes('systemInstruction') || apiErr.message?.includes('system_instruction')) {
         console.warn("Retrying without systemInstruction due to error");
         const response = await ai.models.generateContent({ 
           model: GEMINI_MODEL,
           contents: finalContents
         });
         return res.status(200).json({ text: response.text });
      }
      throw apiErr;
    }
    } catch (err: any) {
      console.error("Vercel Generate Error [Omni-SDK-v3]:", err);
      const errorMsg = err.message || "Generation failed";
      res.status(500).json({ 
        error: `[Omni-SDK-v3] ${errorMsg}`,
        details: err.stack || ""
      });
    }
}
