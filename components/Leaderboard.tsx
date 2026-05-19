
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Trophy, Medal, Star, BookOpen, RefreshCw } from 'lucide-react';
import { ProcessedStudentProfile } from './AdminDashboard';
// FIX: Imported LessonProgress and VocabularyWord from types.ts since they are not exported by storageService.ts.
import { LessonProgress, VocabularyWord } from '../types';
import { StudentProfileData } from '../services/storageService';
import { createInitialDetailedProgress } from '../constants';

const Leaderboard: React.FC = () => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchLeaderboardData = async () => {
        if (!supabase) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('user_id, profile_data');
        
        if (data) {
            const processed = data.map(item => {
                const profile = item.profile_data as any;
                // Safely calculate total completed lessons from the detailedProgress Record
                const totalCompleted: number = Object.values(profile?.detailedProgress || {}).reduce((acc: number, curr: any) => 
                    acc + (Array.isArray(curr?.completedLessonNumbers) ? curr.completedLessonNumbers.length : 
                          (typeof curr?.completedLessons === 'number' ? (curr.completedLessons as number) : 0)), 0) as number;
                
                const masteredWords: number = (profile?.vocabulary?.filter((v: any) => v.masteryLevel >= 3).length || 0) as number;
                
                // Score calculation: Lessons count + Words count + Level bonus
                let score = (totalCompleted * 10) + (masteredWords * 5);
                if (profile?.diagnosedLevel === 'B2') score += 100;
                if (profile?.diagnosedLevel === 'C') score += 200;

                return {
                    name: profile?.name || item.user_id.split('@')[0],
                    score,
                    lessons: totalCompleted,
                    words: masteredWords,
                    level: profile?.diagnosedLevel || 'A2'
                };
            }).sort((a, b) => b.score - a.score);
            setProfiles(processed);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLeaderboardData();
    }, []);

    if (isLoading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;
    }

    return (
        <div className="p-6 h-full overflow-y-auto animate-in fade-in duration-500">
            <header className="mb-8 text-center">
                <Trophy className="mx-auto text-amber-500 mb-2" size={48} />
                <h2 className="text-3xl font-bold text-slate-800 serif">Bảng Xếp Hạng Aptis Master</h2>
                <p className="text-slate-500 mt-2">Vinh danh những học viên xuất sắc nhất tuần này.</p>
                <button onClick={fetchLeaderboardData} className="mt-4 flex items-center gap-2 mx-auto text-sm font-semibold text-teal-600 hover:text-teal-700">
                    <RefreshCw size={14} /> Cập nhật bảng xếp hạng
                </button>
            </header>

            <div className="max-w-3xl mx-auto space-y-4">
                {profiles.map((profile, index) => {
                    const isTop3 = index < 3;
                    const MedalIcon = index === 0 ? Medal : index === 1 ? Medal : index === 2 ? Medal : null;
                    const medalColor = index === 0 ? 'text-amber-400' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : '';

                    return (
                        <div key={profile.name} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isTop3 ? 'bg-white shadow-md border-teal-100 scale-[1.02]' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isTop3 ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className={`font-bold truncate ${isTop3 ? 'text-teal-900 text-lg' : 'text-slate-800'}`}>{profile.name}</h4>
                                    {MedalIcon && <MedalIcon className={medalColor} size={20} />}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                                    <span className="flex items-center gap-1"><BookOpen size={12}/> {profile.lessons} Bài</span>
                                    <span className="flex items-center gap-1"><Star size={12}/> {profile.words} Từ vựng</span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">{profile.level}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`text-2xl font-black ${isTop3 ? 'text-teal-600' : 'text-slate-400'}`}>{profile.score}</div>
                                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Điểm kinh nghiệm</div>
                            </div>
                        </div>
                    );
                })}

                {profiles.length === 0 && (
                    <div className="text-center py-20 text-slate-400 italic">
                        Chưa có dữ liệu xếp hạng. Hãy bắt đầu bài học đầu tiên!
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
