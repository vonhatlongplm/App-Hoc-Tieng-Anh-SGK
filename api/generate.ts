import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"; // Switched to 2.0 as primary default, can be overridden by environment variable

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

// Resilient helper to list available models and select the best supported one
const getBestAvailableModel = async (ai: any, preferredModel: string): Promise<string> => {
  try {
    console.log("[Omni-SDK-v3] Querying available models for this API key...");
    const modelsResponse = await ai.models.list();
    const list = modelsResponse?.page || [];
    
    const modelNames = list.map((m: any) => m.name?.replace(/^models\//, '') || "");
    console.log("[Omni-SDK-v3] Supported models on this key:", modelNames);
    
    // 1. Check exact match
    const exactMatch = list.find((m: any) => m.name && m.name.toLowerCase().replace(/^models\//, '') === preferredModel.toLowerCase());
    if (exactMatch && exactMatch.name) {
      return exactMatch.name.replace(/^models\//, '');
    }
    
    // 2. Candidate pool in priority order
    const fallbackCandidates = [
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite-preview",
      "gemini-2.0-flash-exp"
    ];
    for (const cand of fallbackCandidates) {
      if (modelNames.includes(cand)) {
        console.log(`[Omni-SDK-v3] Falling back to supported available candidate: ${cand}`);
        return cand;
      }
    }
    
    // 3. Any model supporting generateContent action
    const supportedModel = list.find((m: any) => 
      m.name && 
      m.supportedActions && 
      m.supportedActions.some((act: string) => act.toLowerCase().includes("generatecontent"))
    );
    if (supportedModel && supportedModel.name) {
      const selected = supportedModel.name.replace(/^models\//, '');
      console.log(`[Omni-SDK-v3] Selecting first API model supporting generateContent: ${selected}`);
      return selected;
    }
    
    // 4. Any model keyword match
    const geminiModel = list.find((m: any) => m.name && m.name.toLowerCase().includes("gemini"));
    if (geminiModel && geminiModel.name) {
      const selected = geminiModel.name.replace(/^models\//, '');
      console.log(`[Omni-SDK-v3] Selecting any Gemini model: ${selected}`);
      return selected;
    }
  } catch (err) {
    console.error("[Omni-SDK-v3] Warning: Failed to retrieve models from list API:", err);
  }
  return preferredModel;
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

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("Vercel Generate Error: GEMINI_API_KEY is missing");
      return res.status(401).json({ error: "[Omni-SDK-v3] GEMINI_API_KEY is missing. Vui lòng thêm biến này vào Settings > Environment Variables trên Vercel và Redeploy lại app." });
    }

    const ai = getGenAI();
    
    // Mapping contents
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

    let activeModel = GEMINI_MODEL;
    console.log(`[Omni-SDK-v3] Initial API model request: ${activeModel}`);

    let response;
    let fallbackModels = [
      activeModel,
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite-preview"
    ];
    // Remove duplicates but keep primary order intact
    fallbackModels = Array.from(new Set(fallbackModels)).filter(m => m !== "gemini-1.5-flash" && m !== "gemini-1.5-flash-8b");

    let lastError = null;
    for (let i = 0; i < fallbackModels.length; i++) {
      const modelToTry = fallbackModels[i];
      console.log(`[Omni-SDK-v3] Vercel API generation effort (Attempt ${i + 1}/${fallbackModels.length}) using Model: ${modelToTry}`);
      try {
        response = await ai.models.generateContent({ 
          model: modelToTry,
          contents: finalContents,
          config: {
            systemInstruction: systemInstruction ? String(systemInstruction) : undefined,
            temperature: 0.7,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 4096, // Optimizing token size limits under free-tier quotas to be safe
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ]
          }
        });
        
        activeModel = modelToTry;
        lastError = null;
        console.log(`[Omni-SDK-v3] Generation successful with model: ${modelToTry}`);
        break;
      } catch (err: any) {
        lastError = err;
        const errStr = String(err).toLowerCase();
        const isRateLimit = err.status === 429 || err.code === 429 || errStr.includes("429") || errStr.includes("exhausted") || errStr.includes("quota") || errStr.includes("rate limit") || errStr.includes("limit_exceeded");
        const isNotFoundError = err.status === 404 || err.code === 404 || errStr.includes("404") || errStr.includes("not found") || errStr.includes("not_found") || errStr.includes("unsupported");

        console.warn(`[Omni-SDK-v3] Attempt ${i + 1} (${modelToTry}) failed. QuotaExceeded: ${isRateLimit}, NotFound: ${isNotFoundError}. Message: `, err.message || err);
        
        if (isRateLimit && i < fallbackModels.length - 1) {
          console.log("[Omni-SDK-v3] Quota limit hit. Sleeping 1500ms before falling back to next prioritized model...");
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    if (lastError && !response) {
      console.warn("[Omni-SDK-v3] Primary model cascade list failed. Attempting absolute emergency bypass call with standard gemini-3.5-flash...");
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: finalContents
        });
      } catch (finalErr: any) {
        console.error("[Omni-SDK-v3] Emergency bypass call failed as well: ", finalErr);
        const isQuota = String(finalErr).toLowerCase().includes("exhausted") || String(finalErr).toLowerCase().includes("quota") || String(finalErr).toLowerCase().includes("429");
        if (isQuota) {
          throw new Error("Tài khoản API Key đang hết lượt dùng (RESOURCE_EXHAUSTED). Vui lòng đợi khoảng 15-30 giây để hệ thống tự động thiết lập lại quota. Nhờ kiến trúc tối ưu tự động của Omni, hệ thống sẽ tự khôi phục sau giây lát!");
        }
        throw finalErr;
      }
    }

    const text = response.text;
    if (!text) {
      console.warn("Gemini returned empty text response");
      return res.status(200).json({ text: "Gia sư không thể phản hồi lúc này. Vui lòng thử lại câu hỏi khác." });
    }

    res.status(200).json({ text });
  } catch (err: any) {
    console.error("Vercel Generate Error [Omni-SDK-v3]:", err);
    const errorMsg = err.message || "Generation failed";
    res.status(500).json({ 
      error: `[Omni-SDK-v3] ${errorMsg}`,
      details: err.stack ? err.stack.substring(0, 500) : "No stack"
    });
  }
}
