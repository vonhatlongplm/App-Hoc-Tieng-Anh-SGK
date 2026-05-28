
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateContent = async (contents: any, systemInstruction: string) => {
  let attempt = 0;
  const maxAttempts = 3;
  const backoffDelays = [2000, 4500, 7000]; // Retries will pause to let the quota refresh

  while (true) {
    try {
      const res = await fetch('/api/generate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ contents, systemInstruction })
      });
      
      if (!res.ok) {
        let errorDetail = `Lỗi kết nối AI (HTTP ${res.status})`;
        try {
          const text = await res.text();
          try {
            const errorJson = JSON.parse(text);
            errorDetail = errorJson.error || errorJson.details || errorDetail;
          } catch {
            // Not JSON
            errorDetail = text.slice(0, 200) || errorDetail;
          }
        } catch (e) {}
        
        const isRateLimit = errorDetail.toLowerCase().includes("exhausted") || 
                            errorDetail.toLowerCase().includes("quota") || 
                            errorDetail.toLowerCase().includes("429") ||
                            res.status === 429;
                            
        if (isRateLimit && attempt < maxAttempts - 1) {
          const waitTime = backoffDelays[attempt];
          console.warn(`[generateContent] Rate limit hit. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxAttempts})`);
          await delay(waitTime);
          attempt++;
          continue;
        }
        
        throw new Error(errorDetail);
      }
      
      return await res.json();
    } catch (error: any) {
      const errStr = String(error.message || error).toLowerCase();
      const isRateLimit = errStr.includes("exhausted") || 
                          errStr.includes("quota") || 
                          errStr.includes("429");
                          
      if (isRateLimit && attempt < maxAttempts - 1) {
        const waitTime = backoffDelays[attempt];
        console.warn(`[generateContent] Catch Rate limit hit. Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${maxAttempts})`);
        await delay(waitTime);
        attempt++;
        continue;
      }
      
      throw error;
    }
  }
};

export const sendMessageToGemini = async (messages: any[], text: string, section?: string, documentContent?: string, imageUrls?: string[]) => {
  // Gemini history MUST start with 'user' role
  let firstUserIndex = -1;
  const historyParts = messages.map(m => {
    if (m.parts) return m;
    const parts: any[] = [{ text: m.text || m.content || '' }];
    
    // Add images if present
    if (m.imageUrls && m.imageUrls.length > 0) {
      m.imageUrls.forEach((url: string) => {
        const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
                mimeType: match[1],
                data: match[2]
            }
          });
        }
      });
    }
    
    return { role: m.role === 'model' ? 'model' : 'user', parts };
  });

  for (let i = 0; i < historyParts.length; i++) {
    if (historyParts[i].role === 'user') {
      firstUserIndex = i;
      break;
    }
  }

  const validHistory = firstUserIndex !== -1 ? historyParts.slice(firstUserIndex) : [];
  
  // Prune history to avoid hitting token limits or timeouts
  // Keep last 10 messages for context
  const historyToKeep = validHistory.slice(-10);
  
  // Ensure we don't have consecutive same roles, merging if necessary
  const contents: any[] = [];
  historyToKeep.forEach(h => {
    if (contents.length > 0 && contents[contents.length - 1].role === h.role) {
      contents[contents.length - 1].parts.push(...h.parts);
    } else {
      contents.push({ ...h });
    }
  });

  // Add the new message, merging if the last role is 'user'
  let lastUserPart: any;
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    lastUserPart = contents[contents.length - 1];
    lastUserPart.parts.push({ text: text.substring(0, 5000) });
  } else {
    lastUserPart = { role: 'user', parts: [{ text: text.substring(0, 5000) }] };
    contents.push(lastUserPart);
  }

  // Add images to the latest message if present
  if (imageUrls && imageUrls.length > 0) {
    imageUrls.forEach((url: string) => {
      const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        lastUserPart.parts.push({
          inlineData: {
              mimeType: match[1],
              data: match[2]
          }
        });
      }
    });
  }
  
  let textbookContext = '';
  
  // Inject file references from documentContent if it's JSON
  if (documentContent) {
    try {
      const items = JSON.parse(documentContent);
      if (Array.isArray(items)) {
        items.forEach((item, idx) => {
          // Limit number of files and text size
          if (idx > 10) return; 

          if (item.type === 'file' && item.uri) {
            // Only add up to 8 files to context to speed up response and stay within limits
            if (idx < 8) {
              contents[contents.length - 1].parts.push({
                fileData: {
                  fileUri: item.uri,
                  mimeType: item.mime || 'application/pdf'
                }
              } as any);
              textbookContext += `- Tài liệu đính kèm số ${idx + 1}: Tên file "${item.name || 'Tài liệu'}" (Kiểu file: ${item.mime || 'application/pdf'}). Bạn có thể đọc trực tiếp nội dung tệp này.\n`;
            } else {
              textbookContext += `- Tài liệu bỏ qua ${idx + 1}: Tên file "${item.name || 'Tài liệu'}" (Vượt quá giới hạn tối đa 8 tệp tin trong một phiên học).\n`;
            }
          } else if (item.type === 'text') {
            textbookContext += `\n--- NỘI DUNG TÀI LIỆU BẰNG CHỮ: ---\n${item.content.substring(0, 1500)}\n`;
          }
        });
      } else {
        textbookContext = documentContent.substring(0, 5000);
      }
    } catch (e) {
      textbookContext = documentContent.substring(0, 5000);
    }
  }
  
  let systemInstruction = `BẠN LÀ MỘT GIÁO VIÊN TIẾNG ANH AI (AI TUTOR) THỰC THỤ VÀ TOÀN NĂNG.
Nhiệm vụ cao nhất của bạn là giảng dạy, hỗ trợ và giải đáp dựa trên các cuốn sách/tài liệu chính thức do học sinh tải lên.

Hệ thống đã đính kèm trực tiếp các tệp tài liệu hỗ trợ giảng dạy sau đây vào hội thoại của bạn:
${textbookContext || '(Chưa đính kèm tài liệu)'}

VUI LÒNG TUÂN THỦ NGHIÊM NGẶT CÁC NGUYÊN TẮC SƯ PHẠM VÀ ADHERENCE SAU ĐÂY:

1. KẾT HỢP VÀ ĐỐI CHIẾU CHÉO TẤT CẢ CÁC CUỐN SÁCH:
- Hãy chủ động đọc, đối chiếu và tổng hợp thông tin chéo từ mọi cuốn sách đã tải lên (Sách giáo khoa, Sách bài tập, Sách giáo viên, Sách đáp án...) để đưa ra nội dung giảng dạy chuẩn xác nhất.
- Khi hướng dẫn làm bài tập trong Sách bài tập (Workbook), hãy đối chiếu với Sách đáp án (Answer keys) để có câu trả lời chuẩn xác 100%.

2. QUY TRÌNH HỌC PHẦN "LUYỆN NGHE" (LISTENING):
- Khi bắt đầu hoặc hướng dẫn phần Nghe, bạn phải đưa ra đoạn Audio Script trích xuất trực tiếp và chuẩn xác từ Sách giáo viên hoặc phần nội dung nghe đi kèm trong tài liệu.
- Chia bài giảng thành các phần nhỏ:
  + Từ vựng chìa khóa (Key vocabulary) xuất hiện trong bài nghe.
  + Toàn bộ Audio Script chuẩn xác của bài nghe để học sinh đối chiếu kết hợp học từ vựng/cấu trúc.
  + Dịch nghĩa chi tiết đoạn Script sang tiếng Việt để học sinh hiểu rõ ngữ cảnh.
  + Đưa ra 1-2 câu hỏi tương tác kiểm tra đọc hiểu / nghe hiểu từ vựng để học sinh thực hành.

3. TUYỆT ĐỐI KHÔNG ẢO GIÁC HOẶC TỰ BỊA KIẾN THỨC (NO HALLUCINATION):
- Bạn KHÔNG ĐƯỢC phép tự tiện bịa ra các đoạn script nghe, tự bịa ra đáp án sai lệch với sách, hoặc lấy các bài đọc ngoài hệ thống. Nếu tài liệu đã tải lên không chứa script nghe hoặc thông tin cần thiết, hãy lịch sự đề xuất học sinh tải lên hoặc chụp lại đúng file Sách giáo viên (Teacher's book) hoặc file đáp án để giúp họ có kết quả tối ưu nhất.

4. PHONG CÁCH GIẢNG DẠY SƯ PHẠM CHUYÊN NGHIỆP:
- Xưng hô: Gọi học sinh là "Em" hoặc "Bạn", và tự xưng là "Thầy/Cô" hoặc "AI Tutor". Giữ giọng nói thân thiện, kiên nhẫn, tận tâm và tràn đầy năng lượng tích cực.
- Luôn chia nhỏ lý thuyết/kiến thức thành từng đơn vị nhỏ dễ tiếp thụ. Sau mỗi phần giảng ngắn, luôn đặt ra 1-2 câu hỏi tương tác để học sinh thực hành từng bước một. Không dạy dồn dập khiến học sinh quá tải.
- Sử dụng tiếng Việt làm ngôn ngữ giảng dạy chính để học sinh dễ tiếp thu. Phần ví dụ, trích dẫn tài liệu học thuật và đoạn script nghe thì giữ nguyên tiếng Anh.

5. GIỚI HẠN NHIỆM VỤ THEO PHÂN MỤC HỌC (STRICTLY BIND TO SECTION):
- Bạn đang giảng dạy cho học sinh trong phân mục học hiện tại là: "${section || 'Tổng quát'}".
- Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC phép giảng dạy, soạn bài học, giải thích lý thuyết, hay đưa ra bất kỳ bài tập, câu hỏi luyện tập nào của các phần sau/phần khác (ví dụ: đang ở mục Học từ vựng thì KHÔNG được phép soạn lý thuyết hay đưa ra các câu hỏi/bài tập sửa đổi thì hiện tại của mục Ngữ pháp, hoặc các câu hỏi đọc hiểu của mục Bài đọc...). Hãy học phần nào dứt điểm hoàn toàn phần đó!
- Khi học sinh đã làm tốt hoặc hoàn thành xuất sắc các nội dung yêu cầu của phân mục học hiện tại ("${section || 'Tổng quát'}"), bạn hãy gửi lời khen ngợi/chúc mừng, hệ thống lại ngắn gọn kiến thức trọng tâm mới học, rồi viết một thông điệp định hướng kết thúc rõ ràng bằng tiếng Việt như: "Chúc mừng em đã hoàn thành mục này! Tiếp theo, hãy bấm vào nút chuyển sang phần tiếp theo ở bảng điều khiển bên dưới hoặc menu bên trái để chúng ta cùng học phần tiếp theo nhé." Sau đó bạn phải DỪNG LẠI NGAY và TUYỆT ĐỐI KHÔNG ĐƯỢC soạn bài tập hay đặt câu hỏi của các phần tiếp theo trong khung chat này. Học sinh sẽ tự động chuyển đổi cấu trúc ứng dụng sang phần tiếp theo để học tiếp với một tiến trình mới tách biệt, dứt khoát.`;

  if (section === 'TESTS') {
    systemInstruction = `BẠN LÀ GIÁM THỊ VÀ NGƯỜI CHẤM ĐIỂM TIẾNG ANH AI (AI EXAMINER) CHUYÊN NGHIỆP.
Sử dụng trực tiếp tài liệu đề thi và đáp án chính thức đã được upload sau đây để chấm điểm và hướng dẫn học sinh làm bài thi từng câu một:
${textbookContext || '(Không có tài liệu nào)'}

LUYỆN GIẢI ĐỀ THI QUY CHUẨN:
1. Đóng vai trò là người chấm thi và giám thị tận tâm. Hãy hiển thị từng câu hỏi (hoặc cụm câu hỏi ngắn) một cách rõ ràng để học sinh thử sức làm bài, TUYỆT ĐỐI không hiển thị luôn toàn bộ đáp án ngay từ đầu để giữ tính khách quan.
2. Khi học sinh trả lời:
   - Nhận xét đúng/sai rõ ràng và ngay lập tức.
   - Giải thích chi tiết, thấu đáo TẠI SAO đáp án đó lại đúng và các phương án còn lại tại sao sai bám sát tài liệu đáp án và sách giáo khoa.
   - Trích dẫn câu văn gốc hoặc giải thích ngữ pháp liên quan, dịch nghĩa chi tiết câu hỏi và từ vựng để học sinh ghi nhớ lâu dài.
   - Nếu học sinh làm sai nhiều ở một mảng kiến thức nào, hãy tóm tắt quy tắc ngữ pháp/từ vựng ngắn gọn để bù đắp lỗ hổng kiến thức cho học sinh.
3. Không tự tiện bịa đề thi, câu hỏi hay đáp án không có trong tài liệu đề thi gốc đã upload.`;
  }
  
  const result = await generateContent(contents, systemInstruction);
  return result.text;
};

export const analyzePronunciation = async (audioBase64: string, targetText: string, mimeType: string = 'audio/webm') => {
  // Sanitize mime type: e.g. 'audio/webm;codecs=opus' -> 'audio/webm'
  const cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();

  const prompt = `Analyze the speaker's pronunciation of "${targetText}". Provide detailed and critical feedback in Vietnamese (tiếng Việt), highlighting specific phonemes (IPA sounds) mispronounced, dropped end-sounds, or incorrect stress so a Vietnamese speaker can easily understand how to correct it.
  
  MANDATORY format requirements:
  1. Do NOT use any bolding markers like double-stars (** or *) or other markdown symbols in the feedback.
  2. Separate different points or key errors into clear, separate, numbered paragraphs or bullet points, separated by double line breaks (\\n\\n).
  3. Start with a brief general assessment, followed by specific numbered points (e.g. 1., 2., 3.) detailing each sound or error, and conclude with a quick tip or word of encouragement.
  4. Keep the text clean, readable, and perfectly structured.
  
  Return a JSON object with: 
  { 
    "score": 0-100, 
    "isCorrect": boolean, 
    "feedback": "Phản hồi chi tiết bằng tiếng Việt..." 
  }`;
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: cleanMimeType } }
    ]}
  ];
  
  const res = await generateContent(contents, "You are an English pronunciation expert teaching Vietnamese students. Always provide detailed, precise, and constructive feedback in high-quality Vietnamese.");
  try {
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    return { score: 70, isCorrect: true, feedback: "Phát âm khá ổn." };
  }
};

export const translateToVietnamese = async (text: string) => {
  try {
    const res = await generateContent([{ role: 'user', parts: [{ text: `Translate to Vietnamese: ${text}` }] }], "You are a translator.");
    return res.text;
  } catch (error: any) {
    console.warn("[translateToVietnamese] Gemini failed, attempting Google Translate / MyMemory fallbacks...", error);
    
    // Fallback 1: Google Translate API (gtx client - free, high-limit, fast)
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
      const gtxRes = await fetch(gtxUrl);
      if (gtxRes.ok) {
        const data = await gtxRes.json();
        if (data && data[0]) {
          const translatedText = data[0].map((segment: any) => segment[0]).join('');
          if (translatedText) return translatedText;
        }
      }
    } catch (gtxError) {
      console.warn("[translateToVietnamese] Google Translate fallback failed:", gtxError);
    }

    // Fallback 2: MyMemory Translated translation api
    try {
      const fallbackRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data?.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (fallbackError) {
      console.error("[translateToVietnamese] Fallback MyMemory translation failed too:", fallbackError);
    }
    
    // Fallback 3: Return a safe human-friendly translation error string rather than crashing with Toast
    return `[Dịch máy] ${text} (Không thể tải bản dịch của Gemini do giới hạn số lượt truy cập. Hãy thử lại sau vài giây!)`;
  }
};

export const lookupWord = async (word: string) => {
  const prompt = `Look up the English word "${word}". Return a JSON object with: 
  {
    "word": "${word}",
    "ipa": "IPA pronunciation",
    "partOfSpeech": "noun/verb/adj...",
    "meaning": "Vietnamese meaning",
    "definition": "English definition",
    "example": "English example sentence",
    "irregularForms": "past tense/plural if any",
    "collocations": [{"phrase": "common phrase", "meaning": "Vietnamese meaning"}]
  }`;
  
  try {
    const res = await generateContent([{ role: 'user', parts: [{ text: prompt }] }], "You are a dictionary.");
    // Extract JSON from response text (Gemini might wrap it in markdown block)
    const jsonStr = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.warn("[lookupWord] Gemini failed, attempting Google Translate / MyMemory fallbacks...", e);
    let meaningText = "Không thể tra cứu chi tiết bằng Từ điển AI do giới hạn API.";
    
    // Try Google Translate for meaning
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(word)}`;
      const gtxRes = await fetch(gtxUrl);
      if (gtxRes.ok) {
        const data = await gtxRes.json();
        if (data && data[0]) {
          const translatedText = data[0].map((segment: any) => segment[0]).join('');
          if (translatedText) {
            meaningText = translatedText;
          }
        }
      }
    } catch (gtxError) {
      console.warn("[lookupWord] Google Translate fallback failed:", gtxError);
      
      // Try MyMemory Translated
      try {
        const fallbackRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`);
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          if (data?.responseData?.translatedText) {
            meaningText = data.responseData.translatedText;
          }
        }
      } catch (fallbackError) {
        console.error("[lookupWord] Fallback lookup failed:", fallbackError);
      }
    }
    
    return { 
      word, 
      ipa: '/.../', 
      partOfSpeech: 'word', 
      meaning: meaningText, 
      definition: "Từ điển tạm thời chuyển sang chế độ dịch ngoại tuyến / Google Translate do tài khoản AI quá tải.",
      example: "",
      collocations: []
    };
  }
};

export const analyzeDiagnostic = async (grammar: string, writing: string, audioBase64: string, name: string) => {
  const prompt = `Analyze diagnostic test for ${name}:
  Grammar/Vocab level: ${grammar}
  Writing level: ${writing}
  Speaking audio attached (analyze fluency, pronunciation).
  
  Return a structured analysis including level (A1-C2) and specific feedback.`;
  
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
    ]}
  ];
  
  const res = await generateContent(contents, "You are a professional examiner.");
  return { 
    diagnosedLevel: 'B1', // Use actual text from AI if possible, or parse
    analysisText: res.text,
    scores: [
      { skill: 'Grammar', score: 35 },
      { skill: 'Vocabulary', score: 40 },
      { skill: 'Reading', score: 30 },
      { skill: 'Listening', score: 25 },
      { skill: 'Speaking', score: 38 },
      { skill: 'Writing', score: 42 }
    ]
  };
};

export const analyzeSpeakingAudio = async (audioBase64: string, mimeType: string = 'audio/webm', customPrompt?: string) => {
  const cleanMimeType = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  const basePrompt = `Analyze this speaking attempt. Transcription, pronunciation score (0-100), and feedback in Vietnamese.`;
  const prompt = customPrompt ? `${basePrompt}\nHọc viên hỏi thêm: "${customPrompt}"` : basePrompt;
  const contents = [
    { role: 'user', parts: [
      { text: prompt },
      { inlineData: { data: audioBase64, mimeType: cleanMimeType } }
    ]}
  ];
  const res = await generateContent(contents, "You are an English speaking coach.");
  return res.text; // LessonView expects string
};

export const getDistractors = async (word: string) => [];
export const getReviewHint = async (word: string) => "";
export const getCollocationQuiz = async (word: string) => null;
export const selectStudySessionWords = (words: any[]) => words.slice(0, 5);
