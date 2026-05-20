import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-2.0-flash"; // Switched to 2.0 as primary default for standard availability, fallback will auto-resolve if needed

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
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
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
    console.log(`[Omni-SDK-v3] Calling Gemini with model list entrypoint: ${activeModel}`);

    let response;
    try {
      response = await ai.models.generateContent({ 
        model: activeModel,
        contents: finalContents,
        config: {
          systemInstruction: systemInstruction ? String(systemInstruction) : undefined,
          temperature: 0.7,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 8192,
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ]
        }
      });
    } catch (apiErr: any) {
      console.warn("[Omni-SDK-v3] Primary generation failed. Root error details:", apiErr?.message || apiErr);
      
      const isModelOr404Error = 
        apiErr.status === 404 || 
        apiErr.code === 404 || 
        String(apiErr).toLowerCase().includes("not found") || 
        String(apiErr).toLowerCase().includes("not_found") || 
        String(apiErr).toLowerCase().includes("support");

      if (isModelOr404Error) {
        console.log("[Omni-SDK-v3] Model or system context reports 404/not-found/unsupported. Attempting model discovery fallback...");
        const discoveredModel = await getBestAvailableModel(ai, GEMINI_MODEL);
        if (discoveredModel !== activeModel) {
          activeModel = discoveredModel;
          console.log(`[Omni-SDK-v3] Re-trying generation using discovered model: ${activeModel}`);
          try {
            response = await ai.models.generateContent({ 
              model: activeModel,
              contents: finalContents,
              config: {
                systemInstruction: systemInstruction ? String(systemInstruction) : undefined,
                temperature: 0.7,
              }
            });
          } catch (retryErr: any) {
            console.error("[Omni-SDK-v3] Discovered model retry failed:", retryErr);
            throw apiErr; // Throw original error
          }
        } else {
          // If no new model was found, try with zero configuration as last-resort fallback
          try {
             console.warn("[Omni-SDK-v3] Retrying with minimal configuration on preferred model...");
             const fbResponse = await ai.models.generateContent({ 
               model: GEMINI_MODEL,
               contents: finalContents
             });
             return res.status(200).json({ text: fbResponse.text });
          } catch (secondErr: any) {
             console.error("[Omni-SDK-v3] Minimal configuration fallback failed:", secondErr);
             throw apiErr;
          }
        }
      } else {
        throw apiErr;
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
