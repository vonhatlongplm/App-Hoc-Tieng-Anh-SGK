import React, { useState, useRef } from 'react';
import { PHONICS_RULES } from '../constants';
import { Volume2, Mic, Square, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { analyzePronunciation } from '../services/geminiService';
import { useTTS } from '../hooks/useTTS';

const PhonicsView: React.FC = () => {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [recordingWord, setRecordingWord] = useState<string | null>(null);
  const [analyzingWord, setAnalyzingWord] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { score: number, feedback: string, isCorrect: boolean }>>({});
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const selectedRule = PHONICS_RULES.find(r => r.id === selectedRuleId);
  const { playTTS, isTtsLoading } = useTTS();

  const startRecording = async (word: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          handleAnalyze(word, base64data);
        };
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setRecordingWord(word);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingWord(null);
    }
  };

  const handleAnalyze = async (word: string, audioBase64: string) => {
    setAnalyzingWord(word);
    try {
      const result = await analyzePronunciation(audioBase64, word);
      setResults(prev => ({ ...prev, [word]: result }));
    } catch (error) {
      console.error("Analysis failed", error);
      alert("Có lỗi khi phân tích âm thanh. Vui lòng thử lại.");
    } finally {
      setAnalyzingWord(null);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800 serif">Quy tắc Phát âm (Phonics)</h2>
          <p className="text-slate-500 mt-2">Nắm vững các quy tắc đánh vần để tự tin đọc đúng từ mới.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* List of Rules */}
          <div className="md:col-span-1 space-y-3">
            {PHONICS_RULES.map(rule => (
              <button
                key={rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedRuleId === rule.id
                    ? 'bg-teal-600 text-white border-teal-600 shadow-lg'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
                }`}
              >
                <div className="font-bold">{rule.title}</div>
                <div className={`text-xs mt-1 ${selectedRuleId === rule.id ? 'text-teal-100' : 'text-slate-400'}`}>
                  {rule.examples.length} ví dụ
                </div>
              </button>
            ))}
          </div>

          {/* Rule Details */}
          <div className="md:col-span-2">
            {selectedRule ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-2xl font-bold text-slate-800 mb-4">{selectedRule.title}</h3>
                <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-6">
                  <p className="text-teal-800 leading-relaxed">{selectedRule.description}</p>
                </div>

                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Volume2 size={18} /> Ví dụ thực hành
                </h4>
                
                <div className="space-y-4">
                  {selectedRule.examples.map((ex) => (
                    <div key={ex.word} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-teal-200 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-lg text-slate-800">{ex.word}</span>
                            <span className="font-mono text-sm text-slate-500">{ex.ipa}</span>
                          </div>
                          <div className="text-xs text-slate-400">{ex.meaning}</div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => playTTS(ex.word)}
                            className="p-2 rounded-full bg-white text-teal-600 shadow-sm border border-slate-200 hover:bg-teal-50 transition-colors"
                            title="Nghe phát âm mẫu"
                          >
                            <Volume2 size={20} />
                          </button>
                          
                          <button
                            onClick={() => recordingWord === ex.word ? stopRecording() : startRecording(ex.word)}
                            disabled={analyzingWord === ex.word || (recordingWord !== null && recordingWord !== ex.word)}
                            className={`p-2 rounded-full shadow-sm border transition-all ${
                              recordingWord === ex.word 
                                ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' 
                                : analyzingWord === ex.word
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : 'bg-white text-indigo-600 border-slate-200 hover:bg-indigo-50'
                            }`}
                            title={recordingWord === ex.word ? "Dừng ghi âm" : "Ghi âm giọng bạn"}
                          >
                            {analyzingWord === ex.word ? (
                              <Loader2 size={20} className="animate-spin" />
                            ) : recordingWord === ex.word ? (
                              <Square size={20} fill="currentColor" />
                            ) : (
                              <Mic size={20} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Analysis Result */}
                      {results[ex.word] && (
                        <div className={`mt-2 p-3 rounded-lg text-sm border animate-in fade-in slide-in-from-top-2 ${
                          results[ex.word].score >= 80 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : results[ex.word].score >= 50
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                          <div className="flex items-center gap-2 font-bold mb-1">
                            {results[ex.word].score >= 80 ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            <span>Điểm: {results[ex.word].score}/100</span>
                          </div>
                          <p>{results[ex.word].feedback}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedRule.exceptions.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-bold text-amber-700 mb-2 text-sm uppercase tracking-wider">Ngoại lệ cần nhớ</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRule.exceptions.map(exc => (
                        <span key={exc} className="px-3 py-1 bg-amber-50 text-amber-800 rounded-lg text-sm font-medium border border-amber-100">
                          {exc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-2xl">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Volume2 size={32} className="opacity-50" />
                </div>
                <p>Chọn một quy tắc bên trái để bắt đầu học</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhonicsView;
