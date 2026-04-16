'use client';

import { AppLayout } from '@/components/AppLayout';
import { HelpCircle, Search, Book, MessageCircle, Shield, Zap, ChevronRight } from 'lucide-react';

export default function HelpPage() {
  const categories = [
    { icon: Zap, title: 'Getting Started', description: 'Learn the basics of Aura and how to set up your profile.' },
    { icon: Shield, title: 'Privacy & Safety', description: 'Manage your privacy settings and stay safe in our community.' },
    { icon: Book, title: 'Using Aura', description: 'Detailed guides on posts, interests, and networking.' },
    { icon: MessageCircle, title: 'Contact Support', description: 'Can\'t find what you need? Talk to our human support team.' },
  ];

  const faqs = [
    'How do Dynamic Intelligent Interests work?',
    'Can I change my profile visibility?',
    'What is Focus Mode?',
    'How do I report inappropriate content?',
    'How can I delete my account?',
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex flex-col items-center text-center mb-12">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight">How can we help you?</h1>
          <div className="w-full max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search for articles, guides, or FAQs..." 
              className="w-full bg-white border border-border/50 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {categories.map((category, i) => (
            <button key={i} className="bg-white p-6 rounded-3xl border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all text-left group">
              <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <category.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{category.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{category.description}</p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-8">
          <h2 className="text-xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <button key={i} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-all text-left group">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{faq}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 bg-primary/5 rounded-3xl p-8 border border-primary/10 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Still need help?</h2>
          <p className="text-muted-foreground mb-6">Our support team is available 24/7 to assist you with any issues.</p>
          <button className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
            Start a Live Chat
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
