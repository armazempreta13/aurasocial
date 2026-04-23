'use client';

import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { HelpCircle, Search, MessageCircle, Shield, ChevronRight, Settings, Monitor, BookOpen } from 'lucide-react';

export default function HelpPage() {
  const categories = [
    { icon: Settings, title: 'Configuracoes', description: 'Conta, privacidade e preferencias com contexto claro.' },
    { icon: Monitor, title: 'Tela e acessibilidade', description: 'Modo foco e ajustes para uma experiencia mais limpa.' },
    { icon: Shield, title: 'Privacidade e seguranca', description: 'Controle quem pode ver, seguir e falar com voce.' },
    { icon: MessageCircle, title: 'Suporte direto', description: 'Quando algo trava, voce sabe exatamente para onde ir.' },
  ];

  const quickLinks = [
    { href: '/settings', title: 'Abrir configuracoes', description: 'Editar conta, privacidade e notificacoes.' },
    { href: '/settings?tab=display', title: 'Tela e acessibilidade', description: 'Ajustar foco, visual e comportamento da interface.' },
    { href: '/feedback', title: 'Dar feedback', description: 'Reportar bug, friccao de UX ou pedir melhoria.' },
  ];

  const faqs = [
    'Como funcionam os interesses dinamicos da Aura?',
    'Posso alterar a visibilidade do meu perfil?',
    'O que muda quando ativo o modo foco?',
    'Como denunciar um conteudo inadequado?',
    'Como atualizar minhas configuracoes de amizade e privacidade?',
  ];

  return (
    <AppLayout wide={true} hideRightPanel={true}>
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">Ajuda e suporte</h1>
            <p className="text-muted-foreground text-lg leading-8">
              Encontre respostas, atalhos e caminhos de suporte sem precisar adivinhar para onde ir.
            </p>
          </div>
          <div className="w-full max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar artigos, guias e perguntas frequentes..."
              className="w-full bg-white border border-border/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((category) => (
              <button key={category.title} className="bg-white p-6 rounded-3xl border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left group">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <category.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{category.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{category.description}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Atalhos uteis</h2>
                <p className="text-sm text-muted-foreground">Acesse o que voce mais precisa.</p>
              </div>
            </div>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-4 hover:bg-muted/50 transition-all">
                  <div>
                    <div className="font-semibold text-foreground">{link.title}</div>
                    <div className="text-sm text-muted-foreground">{link.description}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-8">
          <h2 className="text-xl font-bold text-foreground mb-6">Perguntas frequentes</h2>
          <div className="space-y-2">
            {faqs.map((faq) => (
              <button key={faq} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-all text-left group">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{faq}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 bg-primary/5 rounded-3xl p-8 border border-primary/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Ainda precisa de ajuda?</h2>
            <p className="text-muted-foreground max-w-2xl">
              Se a resposta nao estiver aqui, abra feedback e descreva o problema com contexto.
            </p>
          </div>
          <Link href="/feedback" className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all text-center">
            Abrir feedback
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
