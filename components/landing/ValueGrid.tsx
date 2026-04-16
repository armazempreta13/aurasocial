import { BrainCircuit, Medal, MessagesSquare, Users } from 'lucide-react';

const items = [
  {
    icon: BrainCircuit,
    title: 'Feed inteligente',
    description: 'O conteúdo sobe por relevância e qualidade, não só por barulho ou volume.',
  },
  {
    icon: Users,
    title: 'Comunidades por interesse',
    description: 'Entre em grupos que fazem sentido para seu contexto e descubra pessoas certas.',
  },
  {
    icon: Medal,
    title: 'Reputação baseada em qualidade',
    description: 'Contribuições úteis ganham mais espaço e constroem credibilidade real.',
  },
  {
    icon: MessagesSquare,
    title: 'Experiência mais útil',
    description: 'Menos ruído, menos viral vazio e mais conversas que ajudam você a avançar.',
  },
];

export function ValueGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8 lg:py-18">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Por que Aura</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
          A rede social projetada para clareza, contexto e descoberta relevante.
        </h2>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
