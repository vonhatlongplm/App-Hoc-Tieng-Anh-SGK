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
let cachedBestModel: string | null = null;

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
  if (cachedBestModel) return cachedBestModel;
  try {
    console.log("[Omni-SDK-v3] Querying available models for this API key...");
    
    // Add a 3000ms timeout to avoid hanging the entire request on start if list() hangs
    const listPromise = ai.models.list();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout listing models")), 3000));
    
    const modelsResponse = await Promise.race([listPromise, timeoutPromise]) as any;
    const list = modelsResponse?.page || [];
    
    const modelNames = list.map((m: any) => m.name?.replace(/^models\//, '') || "");
    console.log("[Omni-SDK-v3] Supported models on this key:", modelNames);
    
    // 1. Check exact match
    const exactMatch = list.find((m: any) => m.name && m.name.toLowerCase().replace(/^models\//, '') === preferredModel.toLowerCase());
    if (exactMatch && exactMatch.name) {
      cachedBestModel = exactMatch.name.replace(/^models\//, '');
      return cachedBestModel;
    }
    
    // 2. Candidate pool in priority order
    const fallbackCandidates = [
      "gemini-3.5-flash",
      "gemini-2.1-flash",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ];
    for (const cand of fallbackCandidates) {
      if (modelNames.includes(cand)) {
        console.log(`[Omni-SDK-v3] Falling back to supported available candidate: ${cand}`);
        cachedBestModel = cand;
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
      cachedBestModel = selected;
      return cachedBestModel;
    }
    
    // 4. Any model keyword match
    const geminiModel = list.find((m: any) => m.name && m.name.toLowerCase().includes("gemini"));
    if (geminiModel && geminiModel.name) {
      const selected = geminiModel.name.replace(/^models\//, '');
      console.log(`[Omni-SDK-v3] Selecting any Gemini model: ${selected}`);
      cachedBestModel = selected;
      return cachedBestModel;
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
        "gemini-flash-latest",
        "gemini-1.5-flash"
      ];
      // Remove duplicates but keep primary order intact
      fallbackModels = Array.from(new Set(fallbackModels)).filter(m => m !== "gemini-1.5-flash-8b");

      let lastError = null;
      for (let i = 0; i < fallbackModels.length; i++) {
        const modelToTry = fallbackModels[i];
        console.log(`[Omni-SDK-v3] Dev Server generation effort (Attempt ${i + 1}/${fallbackModels.length}) using Model: ${modelToTry}`);
        
        let retries = 3;
        let delay = 2000;
        let modelSuccess = false;

        for (let r = 0; r < retries; r++) {
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
            modelSuccess = true;
            break;
          } catch (err: any) {
            lastError = err;
            const errStr = String(err).toLowerCase();
            const isRateLimit = err.status === 429 || err.code === 429 || errStr.includes("429") || errStr.includes("exhausted") || errStr.includes("quota") || errStr.includes("rate limit") || errStr.includes("limit_exceeded");
            const isNotFoundError = err.status === 404 || err.code === 404 || errStr.includes("404") || errStr.includes("not found") || errStr.includes("not_found") || errStr.includes("unsupported");
            const isAuthError = err.status === 401 || err.status === 403 || errStr.includes("api key") || errStr.includes("api_key") || errStr.includes("unauthorized") || errStr.includes("invalid key");

            // Self-heal: If it is a file-related or bad request error, and we passed files, try to scrub files and retry text-only
            const isFileError = errStr.includes("file") || errStr.includes("uri") || errStr.includes("blob") || errStr.includes("not found") || errStr.includes("404") || errStr.includes("expired") || errStr.includes("400") || errStr.includes("invalid argument");
            if (isFileError && Array.isArray(finalContents) && finalContents.some((c: any) => c.parts?.some((p: any) => p.fileData))) {
              console.warn("[Omni-SDK-v3] File-related error encountered. Self-healing by removing fileData parts and retrying immediately...");
              const scrubbedContents = finalContents.map((c: any) => ({
                ...c,
                parts: c.parts?.filter((p: any) => !p.fileData) || []
              })).filter((c: any) => c.parts.length > 0);
              
              if (scrubbedContents.length > 0) {
                try {
                  response = await ai.models.generateContent({ 
                    model: modelToTry,
                    contents: scrubbedContents,
                    config: {
                      systemInstruction: systemInstruction ? String(systemInstruction) : undefined,
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
                  });
                  activeModel = modelToTry;
                  lastError = null;
                  console.log(`[Omni-SDK-v3] Self-healed successfully using text-only format on model: ${modelToTry}`);
                  modelSuccess = true;
                  break;
                } catch (scrubErr: any) {
                  console.error("[Omni-SDK-v3] Text-only self-heal failed as well:", scrubErr);
                }
              }
            }

            console.warn(`[Omni-SDK-v3] Dev Server attempt ${i + 1}, Retry ${r + 1}/${retries} (${modelToTry}) failed. QuotaExceeded: ${isRateLimit}, NotFound: ${isNotFoundError}. Message: `, err.message || err);
            
            if (isAuthError) {
              console.error("[Omni-SDK-v3] Auth error detected. Breaking retry loop.");
              break;
            }

            if (isRateLimit && r < retries - 1) {
              console.log(`[Omni-SDK-v3] Quota limit hit. Sleeping ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            } else {
              break;
            }
          }
        }

        const lastErrStr = String(lastError).toLowerCase();
        const isAuthErrorGlobal = lastError?.status === 401 || lastError?.status === 403 || lastErrStr.includes("api key") || lastErrStr.includes("api_key") || lastErrStr.includes("unauthorized") || lastErrStr.includes("invalid key");
        const isQuotaGlobal = lastError?.status === 429 || lastError?.code === 429 || lastErrStr.includes("429") || lastErrStr.includes("exhausted") || lastErrStr.includes("quota") || lastErrStr.includes("rate limit");

        if (modelSuccess && response) {
          break;
        } else if (isAuthErrorGlobal || isQuotaGlobal) {
          console.log(`[Omni-SDK-v3] Fail-fast triggered due to Auth/Quota error. Skipping other fallback models.`);
          break;
        } else if (i < fallbackModels.length - 1) {
          console.log("[Omni-SDK-v3] Sleeping 1000ms before falling back to next prioritized model...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (lastError && !response) {
        const lastErrStr = String(lastError).toLowerCase();
        const isAuthErrorMsg = lastError?.status === 401 || lastError?.status === 403 || lastErrStr.includes("api key") || lastErrStr.includes("api_key") || lastErrStr.includes("unauthorized") || lastErrStr.includes("invalid key");
        
        if (isAuthErrorMsg) {
          throw lastError;
        }

        console.warn("[Omni-SDK-v3] Primary dev server model cascade failed. Attempting absolute emergency bypass call with standard gemini-3.5-flash...");
        try {
          // Send scrubbed contents if there was any file error
          const scrubbedContents = finalContents.map((c: any) => ({
            ...c,
            parts: c.parts?.filter((p: any) => !p.fileData) || []
          })).filter((c: any) => c.parts.length > 0);

          response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: scrubbedContents.length > 0 ? scrubbedContents : finalContents
          });
        } catch (finalErr: any) {
          console.error("[Omni-SDK-v3] Dev server emergency bypass failed as well: ", finalErr);
          const isQuota = String(finalErr).toLowerCase().includes("exhausted") || String(finalErr).toLowerCase().includes("quota") || String(finalErr).toLowerCase().includes("429");
          if (isQuota) {
            throw new Error("Tài khoản API Key đang hết lượt dùng (RESOURCE_EXHAUSTED). Vui lòng đợi khoảng 15-30 giây để hệ thống tự động thiết lập lại quota. Nhờ cấu trúc tự phục hồi của Omni, hệ thống sẽ tự khôi phục sau giây lát!");
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
