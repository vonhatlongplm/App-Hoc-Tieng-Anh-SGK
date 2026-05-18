import React from 'react';
import { DiagnosticAttempt } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, Award, Bot, Volume2, Edit3, Map, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface DiagnosticResultsViewProps {
  attempt: DiagnosticAttempt;
  onBack: () => void;
  onStartRoadmap: () => void;
  onRetry: (failedAttempt: DiagnosticAttempt) => void;
  isRetrying: boolean;
}

const DiagnosticResultsView: React.FC<DiagnosticResultsViewProps> = ({ attempt, onBack, onStartRoadmap, onRetry, isRetrying }) => {
  const levelDescription = {
    'A2': 'Bạn có kiến thức nền tảng tốt và có thể giao tiếp trong các tình huống quen thuộc.',
    'B1': 'Bạn có khả năng sử dụng tiếng Anh một cách độc lập trong phần lớn các tình huống.',
    'B2': 'Bạn có thể giao tiếp một cách tự tin, trôi chảy và hiểu các văn bản phức tạp.',
    'C': 'Bạn đã đạt đến trình độ sử dụng tiếng Anh thành thạo, gần như người bản xứ.',
  };
  
  const playAudio = () => {
    const audio = new Audio(`data:audio/webm;base64,${attempt.audioBase64}`);
    audio.play().catch(e => console.error("Audio playback failed:", e));
  };

  const hasAnalysisFailed = attempt.analysisText.toLowerCase().includes('lỗi phân tích');

  // More flexible regex to find the Speaking Analysis section, case-insensitive, optional number.
  const speakingTitleRegex = /(\*\*(?:\d+\.\s*)?Phân tích Kỹ năng [Nn]ói:?\*\*)/i;
  const analysisParts = attempt.analysisText.split(speakingTitleRegex);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = attempt.scores.find(s => s.skill === label);
      return (
        <div className="bg-slate-800 text-white p-2 rounded-lg shadow-lg border border-slate-700">
          <p className="font-bold">{label}</p>
          <p className="text-sm">{`Điểm: ${payload[0].value} / ${dataPoint?.fullMark || 50}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white md:rounded-2xl shadow-sm border border-slate-100 overflow-y-auto animate-in fade-in duration-500 p-6 md:p-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 font-semibold mb-6 self-start">
          <ArrowLeft size={16} /> Quay lại Lịch sử
      </button>

      <header className="text-center mb-8">
        <Award className="mx-auto text-amber-500 mb-2" size={48} />
        <h2 className="text-3xl font-bold text-slate-800 serif">Kết quả Kiểm tra Đầu vào</h2>
        <p className="text-slate-500 mt-2">
            Hoàn thành vào: {new Date(attempt.completedOn).toLocaleString('vi-VN')}
        </p>
      </header>

      <div className="max-w-5xl mx-auto w-full space-y-8">
        {/* Level and Radar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-8 rounded-2xl shadow-lg text-white text-center">
            <p className="font-semibold opacity-80">Trình độ của bạn</p>
            <p className="text-7xl font-bold tracking-tighter my-2">{attempt.diagnosedLevel}</p>
            <p className="opacity-90 max-w-xs mx-auto">{levelDescription[attempt.diagnosedLevel]}</p>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={attempt.scores}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 50]} tick={false} />
                <Radar name="Điểm" dataKey="score" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.6} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Student's Submission */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-3">
                <Edit3 size={20} className="text-slate-500" />
                Bài làm của bạn
            </h3>
            <div className="space-y-4">
                <div>
                    <h4 className="font-semibold text-slate-600">Đáp án Ngữ pháp & Từ vựng:</h4>
                    <p className="text-sm text-slate-800 p-3 bg-slate-50 rounded-md mt-1">{attempt.grammarAnswers}</p>
                </div>
                 <div>
                    <h4 className="font-semibold text-slate-600">Bài viết (Mô tả sở thích):</h4>
                    <p className="text-sm text-slate-800 p-3 bg-slate-50 rounded-md mt-1 whitespace-pre-wrap">{attempt.writingAnswer}</p>
                </div>
            </div>
        </div>

        {/* AI Analysis */}
        <div className={`p-6 rounded-2xl ${hasAnalysisFailed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
           <h3 className={`text-lg font-semibold mb-4 flex items-center gap-3 ${hasAnalysisFailed ? 'text-red-900' : 'text-blue-900'}`}>
              {hasAnalysisFailed ? <AlertTriangle size={20} /> : <Bot size={20} />}
              {hasAnalysisFailed ? 'Lỗi Phân tích' : 'Phân tích & Đề xuất của Gia sư AI'}
           </h3>
           <div className="text-slate-700">
             {hasAnalysisFailed ? (
                <div className="text-center">
                    <p className="text-red-800 mb-4">{attempt.analysisText}</p>
                    <button 
                        onClick={() => onRetry(attempt)}
                        disabled={isRetrying}
                        className="flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-red-300"
                    >
                        {isRetrying ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={16}/>}
                        {isRetrying ? "Đang xử lý..." : "Thử lại Phân tích"}
                    </button>
                </div>
             ) : analysisParts.length === 3 ? (
                  <>
                      <MarkdownRenderer text={analysisParts[0]} />
                      <div className="flex items-start md:items-center gap-4 my-4 flex-col md:flex-row">
                          <div className="flex-1">
                            <MarkdownRenderer text={analysisParts[1]} />
                          </div>
                          <button 
                            onClick={playAudio}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            <Volume2 size={16}/> Nghe lại bài nói
                          </button>
                      </div>
                      <MarkdownRenderer text={analysisParts[2]} />
                  </>
              ) : (
                  <MarkdownRenderer text={attempt.analysisText} />
              )}
           </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center pb-8">
            <button
                onClick={onStartRoadmap}
                disabled={hasAnalysisFailed}
                className="flex items-center justify-center gap-3 w-full max-w-md mx-auto rounded-lg bg-teal-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-transform duration-200 hover:scale-105 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none"
            >
                <Map className="h-6 w-6" /> Bắt đầu Lộ trình học
            </button>
            <p className="text-sm text-slate-500 mt-3">Lộ trình của bạn đã được cá nhân hóa dựa trên kết quả này.</p>
        </div>

      </div>
    </div>
  );
};

export default DiagnosticResultsView;