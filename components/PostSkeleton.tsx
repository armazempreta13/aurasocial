'use client';

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-[40px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-8 mb-8 border border-slate-50 animate-pulse">
      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-[24px] bg-slate-100" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-slate-100 rounded-xl w-1/3" />
          <div className="h-3.5 bg-slate-50 rounded-lg w-1/4" />
        </div>
      </div>
      
      <div className="space-y-4 mb-8">
        <div className="h-4 bg-slate-100 rounded-full w-full" />
        <div className="h-4 bg-slate-100 rounded-full w-full" />
        <div className="h-4 bg-slate-50 rounded-full w-4/5" />
      </div>
 
      <div className="w-full h-[400px] bg-slate-50 rounded-[28px] mb-8" />
 
      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
        <div className="flex gap-4">
          <div className="w-24 h-10 bg-slate-50 rounded-2xl" />
          <div className="w-24 h-10 bg-slate-50 rounded-2xl" />
        </div>
        <div className="w-28 h-10 bg-slate-50 rounded-2xl" />
      </div>
    </div>
  );
}
