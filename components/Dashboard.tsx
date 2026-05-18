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
        { id: 'grammar', title: 'Giai đoạn 1: Nền tảng Ngữ pháp & Từ vựng', description: 'Xây xây dựng nền tảng B2 vững chắc.', unlockedFor: ['A2', 'B1', 'B2', 'C'], section: SectionId.GRAMMAR },
        { id: 'receptive', title: 'Giai đoạn 2: Kỹ năng Tiếp thu', description: 'Luyện tập Đọc và Nghe chuyên sâu.', unlockedFor: ['B1', 'B2', 'C'], section: SectionId.READING },
        { id: 'productive', title: 'Giai đoạn 3: Kỹ năng Sản sinh', description: 'Tập trung vào Viết và Nói nâng cao.', unlockedFor: ['B2', 'C'], section: SectionId.WRITING }
    ];
    
    return stages.map(stage => {
        const isUnlocked = isUndiagnosed || stage.unlockedFor.includes(progress.diagnosedLevel);
        const status = isUnlocked ? 'recommended' : 'locked';
        return <RoadmapStage key={stage.id} {...stage} status={status} onClick={() => onStartLesson(stage.section)} />;
    });
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 serif">Hành trình B2 của bạn</h2>
        <p className="text-slate-500 mt-2">Đánh giá năng lực hiện tại và lộ trình cá nhân hóa của bạn.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold mb-4 text-slate-700">Radar Kỹ năng</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={Object.entries(progress.scores || {}).map(([skill, score]) => ({ skill, score }))}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 50]} tick={false} />
                <Radar name="Current Level" dataKey="score" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.5} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#0f766e', fontWeight: 600 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
            <div className="flex items-center gap-3 mb-2"><Clock className="w-5 h-5 opacity-80" /><span className="font-medium opacity-90">Thời gian dự kiến tới B2</span></div>
            <p className="text-4xl font-bold tracking-tight">{progress.estimatedTimeToB2}</p>
            <p className="text-sm mt-2 opacity-80">Dựa trên 6 học phần PDF</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4"><Award className="w-5 h-5 text-amber-500" /><span className="font-semibold text-slate-700">Tiến độ</span></div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2"><div className="bg-amber-500 h-2.5 rounded-full" style={{ width: `${(progress.completedLessons / progress.totalLessons) * 100}%` }}></div></div>
            <div className="flex justify-between text-sm text-slate-500"><span>{progress.completedLessons} Bài học</span><span>{progress.totalLessons} Tổng</span></div>
          </div>
        </div>
      </div>
      
      {/* Personalized Roadmap */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
         <div className="col-span-1 lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold mb-4 text-slate-700">Lộ trình được cá nhân hóa</h3>
            {isUndiagnosed && (
                 <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-start gap-3">
                    <Lightbulb className="flex-shrink-0 text-amber-500 mt-0.5" />
                    <div>
                        <span className="font-bold">Gợi ý từ giáo viên:</span> Lộ trình của bạn hiện đang mở. Hãy làm để thầy/cô có thể cá nhân hóa các giai đoạn học tập phù hợp nhất với năng lực của em nhé.
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