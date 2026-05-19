import React from 'react';
import { UserProgress, Section, SectionId } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Clock, Award, Lock, Target, ArrowRight, Lightbulb } from 'lucide-react';

interface DashboardProps {
  progress: UserProgress;
  onStartLesson: (section: SectionId) => void;
}

const RoadmapStage: React.FC<{ title: string, description: string, status: 'recommended' | 'locked', onClick: () => void }> = ({ title, description, status, onClick }) => {
    const isRecommended = status === 'recommended';
    return (
        <button 
            onClick={onClick}
            disabled={!isRecommended}
            className={`flex items-start text-left w-full gap-4 p-4 rounded-lg border transition-all duration-200 ${
                isRecommended 
                    ? 'bg-white hover:bg-teal-50/80 border-slate-200 hover:border-teal-300 hover:shadow-md cursor-pointer' 
                    : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
            }`}
        >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isRecommended ? 'bg-teal-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                {isRecommended ? <Target size={18}/> : <Lock size={16} />}
            </div>
            <div className="flex-1">
                <h4 className={`font-bold ${isRecommended ? 'text-teal-800' : 'text-slate-700'}`}>{title}</h4>
                <p className="text-sm text-slate-600">{description}</p>
            </div>
            {isRecommended && <ArrowRight className="text-teal-500 self-center" size={20} />}
        </button>
    )
}

const Dashboard: React.FC<DashboardProps> = ({ progress, onStartLesson }) => {
  const isUndiagnosed = progress.diagnosedLevel === 'Undiagnosed';

  const renderRoadmap = () => {
    const stages = [
        { id: 'foundation', title: 'Giai đoạn 1: Khám phá & Nền tảng', description: 'AI trích xuất từ vựng và ngữ pháp cốt lõi từ sách giáo khoa.', unlockedFor: ['Undiagnosed', 'A2', 'B1', 'B2', 'C'], section: SectionId.VOCABULARY },
        { id: 'receptive', title: 'Giai đoạn 2: Tiếp thu & Đọc hiểu', description: 'Phân tích các đoạn văn và bài nghe trong giáo trình.', unlockedFor: ['B1', 'B2', 'C'], section: SectionId.READING },
        { id: 'productive', title: 'Giai đoạn 3: Thực hành & Vận dụng', description: 'Luyện nói, phát âm và viết dựa trên các chủ đề trong sách.', unlockedFor: ['B2', 'C'], section: SectionId.SPEAKING }
    ];
    
    return stages.map(stage => {
        const isUnlocked = isUndiagnosed || stage.unlockedFor.includes(progress.diagnosedLevel || 'Undiagnosed');
        const status = (isUnlocked ? 'recommended' : 'locked') as 'recommended' | 'locked';
        return <RoadmapStage key={stage.id} {...stage} status={status} onClick={() => onStartLesson(stage.section)} />;
    });
  }

  const radarData = Object.entries(progress.scores || {}).map(([skill, score]) => ({ skill, score }));
  const progressPercentage = progress.totalLessons && progress.totalLessons > 0 
    ? Math.min(100, (progress.completedLessons / progress.totalLessons) * 100) 
    : 0;

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 serif">Giáo trình của bạn</h2>
        <p className="text-slate-500 mt-2">AI đã phân tích tài liệu và thiết lập lộ trình học tập tối ưu cho em.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[350px]">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Năng lực hiện tại</h3>
          <div className="h-[300px] w-full">
            {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={false} />
                    <Radar name="Current Level" dataKey="score" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.5} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#0f766e', fontWeight: 600 }} />
                </RadarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Target size={40} className="opacity-20" />
                    <p className="text-sm">Hãy bắt đầu bài học đầu tiên để AI đánh giá năng lực của em.</p>
                </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 opacity-80" /><span className="font-medium opacity-90">Mục tiêu học tập</span></div>
            <p className="text-4xl font-bold tracking-tight">Làm chủ nội dung</p>
            <p className="text-sm mt-3 opacity-90 leading-relaxed font-medium">Lộ trình được thiết kế dựa trên giáo trình em đã tải lên.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4"><Award className="w-5 h-5 text-amber-500" /><span className="font-semibold text-slate-700">Tiến độ bài học</span></div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
                <span>{progress.completedLessons || 0} Hoàn thành</span>
                <span>{progress.totalLessons || 180} Tổng số mục</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Personalized Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
         <div className="col-span-1 lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Lộ trình nghiên cứu giáo trình</h3>
            {isUndiagnosed && (
                 <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-start gap-3">
                    <Lightbulb className="flex-shrink-0 text-amber-500 mt-0.5" />
                    <div>
                        <span className="font-bold">Gợi ý từ giáo viên:</span> AI đã tổng hợp các cuốn sách của em. Hãy bắt đầu từ Giai đoạn 1 để nắm vững kiến thức nền tảng nhé.
                    </div>
                </div>
            )}
            <div className="space-y-3">{renderRoadmap()}</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;