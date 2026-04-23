export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`} style={{ maxHeight: '40px' }}>
      <img
        src="/logo.png"
        alt="Aura"
        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 12 }}
        draggable={false}
      />
      <span className="text-xl font-black text-[#2a2c5a] dark:text-white tracking-tight leading-none">Aura</span>
    </div>
  );
}
