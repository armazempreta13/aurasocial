'use client';

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-[32px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 mb-6 border border-border/20 animate-pulse">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-100 rounded-full w-1/3" />
          <div className="h-3 bg-slate-50 rounded-full w-1/4" />
        </div>
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="h-4 bg-slate-100 rounded-full w-full" />
        <div className="h-4 bg-slate-100 rounded-full w-full" />
        <div className="h-4 bg-slate-50 rounded-full w-4/5" />
      </div>

      <div className="w-full h-[300px] bg-slate-50 rounded-[24px] mb-6" />

      <div className="flex items-center justify-between pt-4 border-t border-border/10">
        <div className="flex gap-4">
          <div className="w-20 h-8 bg-slate-50 rounded-full" />
          <div className="w-20 h-8 bg-slate-50 rounded-full" />
        </div>
        <div className="w-24 h-8 bg-slate-50 rounded-full" />
      </div>
    </div>
  );
}
