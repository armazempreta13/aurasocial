export type BackgroundOption = {
  id: string;
  type: 'solid' | 'gradient' | 'premium' | 'aura';
  value: string; // CSS value
  textColor: 'white' | 'slate-900';
  name: string;
  previewColor?: string; // Color for the picker thumbnail
};

export const POST_BACKGROUNDS: BackgroundOption[] = [
  // AURA SIGNATURE
  { id: 'aura-1', type: 'aura', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', textColor: 'white', name: 'Aura Classic', previewColor: '#6366f1' },
  { id: 'aura-2', type: 'aura', value: 'radial-gradient(circle at top left, #8b5cf6, #6366f1, #0f172a)', textColor: 'white', name: 'Aura Night', previewColor: '#1e1b4b' },
  { id: 'aura-3', type: 'aura', value: 'linear-gradient(225deg, #ff3cac 0%, #784ba0 50%, #2b86c5 100%)', textColor: 'white', name: 'Aura Prism', previewColor: '#784ba0' },

  // PREMIUM GRADIENTS
  { id: 'grad-1', type: 'gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', textColor: 'white', name: 'Strawberry', previewColor: '#f5576c' },
  { id: 'grad-2', type: 'gradient', value: 'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)', textColor: 'white', name: 'Lavender Breeze', previewColor: '#b490ca' },
  { id: 'grad-3', type: 'gradient', value: 'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)', textColor: 'slate-900', name: 'Mint Spring', previewColor: '#43e97b' },
  { id: 'grad-4', type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textColor: 'white', name: 'Plum Plate', previewColor: '#764ba2' },
  { id: 'grad-5', type: 'gradient', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', textColor: 'slate-900', name: 'Golden Hour', previewColor: '#f6d365' },

  // MINIMALIST & SOLID
  { id: 'solid-1', type: 'solid', value: '#0f0f12', textColor: 'white', name: 'Deep Carbon', previewColor: '#0f0f12' },
  { id: 'solid-2', type: 'solid', value: '#6366f1', textColor: 'white', name: 'Aura Indigo', previewColor: '#6366f1' },
  { id: 'solid-3', type: 'solid', value: '#f8fafc', textColor: 'slate-900', name: 'Pure White', previewColor: '#f8fafc' },
  { id: 'solid-4', type: 'solid', value: '#ec4899', textColor: 'white', name: 'Vibrant Pink', previewColor: '#ec4899' },
  
  // DARK PREMIUM
  { id: 'dark-1', type: 'premium', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)', textColor: 'white', name: 'Midnight', previewColor: '#232526' },
  { id: 'dark-2', type: 'premium', value: 'radial-gradient(circle, #2d3436 0%, #000000 100%)', textColor: 'white', name: 'Obsidian', previewColor: '#000000' },

  // SOFT AURA BACKDROPS (SVG)
  { id: 'soft-6', type: 'premium', value: "url('/post-backgrounds/soft/06.svg')", textColor: 'slate-900', name: 'Soft 06', previewColor: '#EEF3FF' },
  { id: 'soft-7', type: 'premium', value: "url('/post-backgrounds/soft/07.svg')", textColor: 'slate-900', name: 'Soft 07', previewColor: '#FFF1FA' },
  { id: 'soft-8', type: 'premium', value: "url('/post-backgrounds/soft/08.svg')", textColor: 'slate-900', name: 'Soft 08', previewColor: '#F2EEFF' },
  { id: 'soft-9', type: 'premium', value: "url('/post-backgrounds/soft/09.svg')", textColor: 'slate-900', name: 'Soft 09', previewColor: '#EEF7FF' },
  { id: 'soft-10', type: 'premium', value: "url('/post-backgrounds/soft/10.svg')", textColor: 'slate-900', name: 'Soft 10', previewColor: '#FFF6EE' },
];
