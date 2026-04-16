const feedSignals = [
  { label: 'Conteúdo útil', value: 'Alta prioridade' },
  { label: 'Comunidades em comum', value: '+ relevância social' },
  { label: 'Ruído viral', value: 'Menor alcance' },
];

const interactionBlocks = [
  'Posts com contexto e reputação',
  'Comunidades com discussões organizadas',
  'Sugestões mais inteligentes de pessoas e temas',
];

export default function ProductPreview() {
  return (
    <section id="preview" className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-18">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Preview do produto</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Uma primeira impressão que já comunica produto sólido.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Sem depender de vídeo pesado ou animação exagerada. A landing mostra feed, descoberta e comunidades com uma linguagem visual de produto real.
          </p>

          <div className="mt-8 space-y-3">
            {feedSignals.map((signal) => (
              <div key={signal.label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">{signal.label}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                  {signal.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-sky-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">Ana Ribeiro</p>
                  <p className="text-xs text-slate-500">Compartilhou uma análise em Product Builders</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 rounded-full bg-slate-200" />
                <div className="h-3 w-11/12 rounded-full bg-slate-200" />
                <div className="h-3 w-8/12 rounded-full bg-slate-200" />
              </div>
              <div className="mt-4 rounded-[20px] bg-sky-50 p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {['Relevante', 'Qualidade alta', 'Comunidade em comum'].map((tag) => (
                    <div key={tag} className="rounded-2xl bg-white px-3 py-2 text-center text-xs font-semibold text-slate-600">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {interactionBlocks.map((item, index) => (
              <div
                key={item}
                className={`rounded-[24px] p-5 ${index === 1 ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-950'}`}
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-60">Bloco {index + 1}</p>
                <p className="mt-3 text-lg font-bold leading-7">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
