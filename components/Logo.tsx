export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`} style={{ maxHeight: '40px' }}>
      <div className="h-full aspect-square relative flex-shrink-0" style={{ width: '40px', height: '40px' }}>
        <svg viewBox="0 0 100 100" className="w-full h-full block" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7a63f1" />
              <stop offset="100%" stopColor="#6c55e0" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" rx="28" fill="url(#auraGrad)" />
          <path d="M50 20C54 20 57 22 59 26L76 68C78 73 74 78 69 78C66 78 63 76 62 73L56 58H40L34 73C33 76 30 78 27 78C22 78 18 73 20 68L37 26C39 22 42 20 46 20H50ZM48 35L43 50H53L48 35Z" fill="white" />
        </svg>
      </div>
      <span className="text-xl font-black text-[#2a2c5a] dark:text-white tracking-tight leading-none">Aura</span>
    </div>
  );
}
