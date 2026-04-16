const communities = [
  {
    name: 'AI Builders',
    description: 'Casos reais, testes práticos e discussões sobre IA aplicada ao trabalho.',
    stat: '24 mil membros',
  },
  {
    name: 'Design Systems',
    description: 'Escalabilidade, consistência visual e interfaces melhores para times de produto.',
    stat: '13 mil membros',
  },
  {
    name: 'Growth Brasil',
    description: 'Aquisição, retenção e loops de crescimento com foco em resultado de negócio.',
    stat: '18 mil membros',
  },
];

export default function CommunitiesSection() {
  return (
    <section id="communities" className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-18">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Comunidades</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Conexão por interesse, não por caos.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Aura organiza a descoberta em torno de comunidades com contexto, afinidade e relevância social. Isso melhora tanto o feed quanto as conexões entre pessoas.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {['Design', 'IA', 'Produto', 'Startups', 'Web Dev', 'Marketing'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {communities.map((community) => (
            <div
              key={community.name}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">{community.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{community.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {community.stat}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
