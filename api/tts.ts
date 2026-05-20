export default async function handler(req: any, res: any) {
  try {
    const text = req.query.text || req.body?.text;
    const lang = req.query.lang || req.body?.lang || "en";
    
    if (!text) {
      return res.status(400).json({ error: "Missing text parameter" });
    }

    let ttsUrl = "";
    if (lang === "en") {
      // Youdao voice US accent (type=2) is excellent, stable, and naturally paced
      ttsUrl = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(text)}`;
    } else {
      // Google Translate TTS is naturally fluent for Vietnamese and general translations
      ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
    }

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
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache 24h

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.status(200).send(buffer);
  } catch (err: any) {
    console.error("[Vercel-TTS-Proxy] Error generating speech:", err.message);
    res.status(500).json({ error: "Failed to generate text-to-speech audio", details: err.message });
  }
}
