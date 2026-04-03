/**
 * Декоративная превью-карточка QR для лендинга (не сканируемый код).
 */
export function DemoQrCard() {
  return (
    <div className="group relative rounded-3xl border border-white/90 bg-gradient-to-br from-white via-white to-violet-50/40 p-6 shadow-xl shadow-violet-900/10 backdrop-blur-md transition-all duration-500 hover:scale-[1.02] hover:shadow-violet-900/15">
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-400/40 via-transparent to-sky-400/30 opacity-60 blur-sm transition-opacity group-hover:opacity-90"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Точка контакта</span>
          <span className="rounded-full bg-gradient-to-r from-emerald-500/15 to-teal-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/25">
            бонус за бриф
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <div className="relative">
            {/* Внешняя «рамка сканера» */}
            <div
              className="absolute -inset-3 rounded-[1.75rem] border-2 border-dashed border-violet-200/80 opacity-70"
              aria-hidden
            />
            <div className="relative flex h-44 w-44 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-white p-3 shadow-inner ring-1 ring-slate-200/80">
              <svg viewBox="0 0 120 120" className="h-full w-full text-slate-900" fill="currentColor" aria-hidden>
                <defs>
                  <linearGradient id="qrFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e1b4b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                </defs>
                <rect width="120" height="120" fill="white" rx="8" />
                <g fill="url(#qrFill)">
                  <Finder x={8} y={8} />
                  <Finder x={76} y={8} />
                  <Finder x={8} y={76} />
                  {/* «Данные» — округлые модули */}
                  {[
                    [40, 40],
                    [52, 40],
                    [64, 40],
                    [40, 52],
                    [58, 52],
                    [76, 52],
                    [88, 52],
                    [40, 64],
                    [52, 64],
                    [70, 64],
                    [88, 64],
                    [52, 76],
                    [64, 76],
                    [76, 76],
                    [88, 76],
                    [100, 40],
                    [100, 52],
                    [100, 64],
                    [40, 88],
                    [52, 88],
                    [64, 88],
                    [76, 88],
                    [88, 88],
                    [100, 88],
                    [100, 100],
                    [88, 100],
                    [76, 100],
                  ].map(([cx, cy], i) => (
                    <rect key={i} x={cx} y={cy} width="8" height="8" rx="2.5" />
                  ))}
                </g>
                {/* Центральный логотип-зона */}
                <circle cx="60" cy="60" r="18" fill="white" stroke="#e2e8f0" strokeWidth="1" />
                <text
                  x="60"
                  y="67"
                  textAnchor="middle"
                  fill="#5b21b6"
                  fontSize="15"
                  fontWeight="800"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  CS
                </text>
              </svg>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          В продукте здесь будет <strong className="font-semibold text-slate-700">ваш уникальный QR</strong> из кабинета
          партнёра — клиент сканирует и сразу попадает в бриф.
        </p>
      </div>
    </div>
  );
}

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width="28" height="28" rx="6" fill="#1e1b4b" />
      <rect x="6" y="6" width="16" height="16" rx="3" fill="white" />
      <rect x="10" y="10" width="8" height="8" rx="2" fill="#1e1b4b" />
    </g>
  );
}
