
export default async function handler(req: any, res: any) {
  const key = process.env.GEMINI_API_KEY;
  res.status(200).json({ 
    status: "ok", 
    hasApiKey: !!key,
    keyPrefix: key ? key.trim().substring(0, 6) : "none",
    model: "gemini-3.5-flash",
    sdk: "Omni-SDK-v3 (@google/genai)",
    nodeVersion: process.version
  });
}
