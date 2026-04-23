import type {Metadata} from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

// Using system fonts for Worker compatibility
const inter = { variable: 'font-inter' };

export const metadata: Metadata = {
  title: 'Aura | Rede social inteligente',
  description: 'Uma rede social moderna com feed inteligente, comunidades e conteúdo relevante.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable}`}>
      <body className="bg-background text-foreground min-h-screen flex flex-col font-sans" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
