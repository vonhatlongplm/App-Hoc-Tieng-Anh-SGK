import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import os from "os";
import multer from "multer";
import { GEMINI_MODEL } from "./constants";

let genAI: any = null;
let fileManager: GoogleAIFileManager | null = null;

const upload = multer({ dest: os.tmpdir() });

const getGenAI = () => {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
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
};

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
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
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

const getFileManager = () => {
  if (!fileManager) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing");
    fileManager = new GoogleAIFileManager(key.trim());
  }
  return fileManager;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  app.get("/api/health", (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({ 
      status: "ok", 
      hasApiKey: !!key,
      keyPrefix: key ? key.trim().substring(0, 6) : "none",
      env: process.env.NODE_ENV
    });
  });

  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { name, mimeType } = req.body;

      if (!file) {
        console.error("Upload attempt with no file");
        return res.status(400).json({ error: "No file content" });
      }
      
      console.log(`Processing upload: ${file.originalname}, size: ${file.size}`);
      
      const fileManager = getFileManager();
      const uploadResult = await fileManager.uploadFile(file.path, {
        mimeType: mimeType || file.mimetype || 'application/pdf',
        displayName: (name || file.originalname || 'upload').slice(0, 40),
      });
      
      const { file: uploadedFile } = uploadResult;
      
      // Wait for the file to be processed and become ACTIVE
      let fileStatus = uploadedFile;
      let attempts = 0;
      console.log(`File uploaded to Gemini: ${uploadedFile.name}, current state: ${uploadedFile.state}`);
      
      while ((fileStatus.state === 'PROCESSING' || fileStatus.state === 'STATE_UNSPECIFIED') && attempts < 15) {
        attempts++;
        const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 5000); 
        await new Promise(resolve => setTimeout(resolve, waitTime));
        fileStatus = await fileManager.getFile(uploadedFile.name);
        console.log(`Checking file ${fileStatus.name} status: attempt ${attempts}, state: ${fileStatus.state}`);
      }

      if (fileStatus.state === 'FAILED') {
          console.error("Gemini file processing failed:", fileStatus.error);
          throw new Error(`File processing failed: ${fileStatus.error?.message || "Unknown error"}`);
      }
      
      // Cleanup temp file
      try {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
      } catch (e) {
        console.warn("Could not delete temp file:", e);
      }
      
      console.log(`Upload successful for ${fileStatus.name}`);
      res.json({
        fileUri: fileStatus.uri,
        mimeType: fileStatus.mimeType || mimeType,
        name: name || file.originalname
      });
    } catch (err: any) {
      console.error("Full Upload Error Detail:", err);
      res.status(500).json({ error: err.message || "Unknown upload error" });
    }
  });

  app.post("/api/generate", async (req, res) => {
    console.log("Starting /api/generate request...");
    try {
      const { contents, systemInstruction } = req.body;
      
      if (!contents || !Array.isArray(contents)) {
        console.error("Invalid contents:", contents);
        return res.status(400).json({ error: "Invalid contents format" });
      }

      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        console.error("Local/AI-Studio Generate Error: GEMINI_API_KEY is missing");
        return res.status(401).json({ error: "[Omni-SDK-v3] GEMINI_API_KEY is missing. Vui lòng thêm biến này vào panel Settings > Secrets và khởi động lại server." });
      }

      const ai = getGenAI();
      
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
        console.error("Total failure: No valid parts to send");
        return res.status(400).json({ error: "Không tìm thấy nội dung hợp lệ (Check console logs)" });
      }

      let activeModel = GEMINI_MODEL;
      try {
        activeModel = await getBestAvailableModel(ai, GEMINI_MODEL);
      } catch (err) {
        console.warn("[Omni-SDK-v3] Best available model check failed, using direct preferred:", err);
      }
      console.log(`[Omni-SDK-v3] Initial dev server model request: ${activeModel}`);
      
      let response;
      let fallbackModels = [
        activeModel,
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      ];
      // Remove duplicates but keep primary order intact
      fallbackModels = Array.from(new Set(fallbackModels)).filter(m => m !== "gemini-1.5-flash" && m !== "gemini-1.5-flash-8b");

      let lastError = null;
      for (let i = 0; i < fallbackModels.length; i++) {
        const modelToTry = fallbackModels[i];
        console.log(`[Omni-SDK-v3] Dev Server generation effort (Attempt ${i + 1}/${fallbackModels.length}) using Model: ${modelToTry}`);
        try {
          response = await ai.models.generateContent({ 
            model: modelToTry,
            contents: finalContents,
            config: {
              systemInstruction: systemInstruction ? String(systemInstruction) : undefined,
              temperature: 0.7,
              topP: 0.95,
              topK: 64,
              maxOutputTokens: 2048, // Keeping dev responses optimized
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
          console.log(`[Omni-SDK-v3] Dev Server generation successful with model: ${modelToTry}`);
          break;
        } catch (err: any) {
          lastError = err;
          const errStr = String(err).toLowerCase();
          const isRateLimit = err.status === 429 || err.code === 429 || errStr.includes("429") || errStr.includes("exhausted") || errStr.includes("quota") || errStr.includes("rate limit") || errStr.includes("limit_exceeded");
          const isNotFoundError = err.status === 404 || err.code === 404 || errStr.includes("404") || errStr.includes("not found") || errStr.includes("not_found") || errStr.includes("unsupported");

          console.warn(`[Omni-SDK-v3] Dev Server attempt ${i + 1} (${modelToTry}) failed. QuotaExceeded: ${isRateLimit}, NotFound: ${isNotFoundError}. Message: `, err.message || err);
          
          if (isRateLimit && i < fallbackModels.length - 1) {
            console.log("[Omni-SDK-v3] Quota limit hit. Sleeping 1500ms before falling back to next prioritized model...");
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }

      if (lastError && !response) {
        console.warn("[Omni-SDK-v3] Primary dev server model cascade failed. Attempting absolute emergency bypass call with standard gemini-3.5-flash...");
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: finalContents
          });
        } catch (finalErr: any) {
          console.error("[Omni-SDK-v3] Dev server emergency bypass failed as well: ", finalErr);
          const isQuota = String(finalErr).toLowerCase().includes("exhausted") || String(finalErr).toLowerCase().includes("quota") || String(finalErr).toLowerCase().includes("429");
          if (isQuota) {
            throw new Error("Tài khoản API Key đang hết lượt dùng (RESOURCE_EXHAUSTED). Vui lòng đợi khoảng 15-30 giây để hệ thống tự động thiết lập lại quota. Nhờ kiến trúc tối ưu tự động của Omni, hệ thống sẽ tự khôi phục sau giây lát!");
          }
          throw finalErr;
        }
      }
      
      console.log("Gemini response received successfully.");
      
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason === 'SAFETY') {
          console.warn("AI blocked by safety filters");
          return res.json({ text: "⚠️ Nội dung này bị chặn bởi bộ lọc an toàn." });
      }

      const text = response.text;
      if (!text) {
        console.warn("Empty response text");
        return res.json({ text: "Gia sư không thể phản hồi lúc này." });
      }

      res.json({ text });
    } catch (err: any) {
      console.error("Detailed /api/generate Error [Omni-SDK-v3]:", err);
      const errorMsg = err.message || "Unknown generate error";
      res.status(500).json({ 
        error: `[Omni-SDK-v3] ${errorMsg}`,
        details: err.stack || ""
      });
    }
  });

  // Proxy endpoint for Text-To-Speech to avoid client-side CORS and sandboxing issues
  app.get("/api/tts", async (req, res) => {
    try {
      const text = req.query.text as string;
      const lang = (req.query.lang as string) || "en";
      
      if (!text) {
        return res.status(400).json({ error: "Missing text query parameter" });
      }

      let ttsUrl = "";
      if (lang === "en") {
        // Use Google Translate TTS for English to play exactly once and avoid repeating syllables
        ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
      } else {
        // Google Translate TTS is naturally fluent for Vietnamese and general translations
        ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
      }

      console.log(`[TTS-Proxy] Request context: lang=${lang}, text="${text.substring(0, 40)}..."`);

      const response = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch TTS target. Source status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400"); // Cache audio files for 24h as word pronunciation is stable

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error("[TTS-Proxy] Error generating speech:", err.message);
      res.status(500).json({ error: "Failed to generate text-to-speech audio", details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
