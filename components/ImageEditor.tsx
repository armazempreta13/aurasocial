'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, RotateCw, ZoomIn, ZoomOut, Maximize2, Square, RectangleHorizontal, RectangleVertical, Sun, Contrast, Droplets, SlidersHorizontal, Crop as CropIcon, Type, Sparkles } from 'lucide-react';
import { getCroppedImg } from '@/lib/image-utils';

type Tab = 'crop' | 'rotate' | 'adjust' | 'tag' | 'text' | 'alt';

interface ImageEditorProps {
  image: string;
  initialAlt?: string;
  onSave: (croppedImage: Blob, metadata: { alt?: string; tags?: any[] }) => void;
  onCancel: () => void;
}

export function ImageEditor({ image, initialAlt, onSave, onCancel }: ImageEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('crop');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [altText, setAltText] = useState(initialAlt || '');
  
  console.log('Initial ImageEditor state - aspect:', aspect, 'zoom:', zoom); // Added console log
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Text Tool State
  const [textLayers, setTextLayers] = useState<any[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // Tagging State
  const [tags, setTags] = useState<any[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const addTextLayer = () => {
    const newLayer = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Novo Texto',
      x: 50,
      y: 50,
      size: 15,
      color: '#ffffff',
      font: 'sans-serif'
    };
    setTextLayers([...textLayers, newLayer]);
    setSelectedTextId(newLayer.id);
  };

  const updateTextLayer = (id: string, updates: any) => {
    setTextLayers(textLayers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const removeTextLayer = (id: string) => {
    setTextLayers(textLayers.filter(l => l.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (activeTab === 'tag') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setTags([...tags, { id: Date.now(), x, y, label: 'Alguém' }]);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop);
  }, []);

  const handleSave = async () => {
    try {
      const croppedBlob = await getCroppedImg(
        image, 
        croppedAreaPixels, 
        rotation, 
        { horizontal: false, vertical: false },
        { brightness, contrast, saturate: saturation },
        textLayers
      );
      if (croppedBlob) {
        onSave(croppedBlob, { alt: altText, tags });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f0f12]/95 backdrop-blur-xl p-0 md:p-8"
    >
      <div className="relative w-full h-full max-w-6xl bg-[#0f0f12] md:rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col">
        
        {/* Header - FB Style */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0f0f12] border-b border-white/5 z-20">
          <div className="flex items-center gap-4">
            <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <X size={20} />
            </button>
            <h3 className="text-white font-bold text-[15px] tracking-tight">Detalhe da foto</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">Aura Studio v3.0</p>
          </div>
        </div>

        {/* Editor Layout - Side Nav FB Style */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT SIDEBAR - TOOL SELECTOR */}
          <div className="w-[280px] bg-[#0f0f12] border-r border-white/5 flex flex-col p-4 z-10">
            <div className="space-y-1">
              {[
                { id: 'crop', label: 'Cortar', icon: CropIcon },
                { id: 'rotate', label: 'Girar', icon: RotateCw },
                { id: 'adjust', label: 'Ajustes', icon: SlidersHorizontal },
                { id: 'tag', label: 'Marcar foto', icon: Droplets },
                { id: 'text', label: 'Ferramenta de texto', icon: Type },
                { id: 'alt', label: 'Texto alternativo', icon: Maximize2 },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTab(tool.id as Tab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${
                    activeTab === tool.id 
                      ? 'bg-white/10 text-white shadow-lg' 
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <tool.icon size={18} className={activeTab === tool.id ? 'text-indigo-400' : ''} />
                  {tool.label}
                </button>
              ))}
            </div>

            <div className="mt-auto space-y-3 pt-6 border-t border-white/5">
              <button
                onClick={handleSave}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-[14px] font-black transition-all shadow-lg active:scale-95"
              >
                Concluir
              </button>
              <button
                onClick={onCancel}
                className="w-full bg-white/5 hover:bg-white/10 text-white/60 py-3 rounded-xl text-[14px] font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* MAIN WORKSPACE */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
              style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '32px 32px' }} 
            />
            
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <div className="relative w-full h-full shadow-[0_0_100px_rgba(0,0,0,0.8)]" style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` }}>
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  classes={{
                    containerClassName: "bg-transparent",
                    mediaClassName: "max-h-full max-w-full object-contain",
                    cropAreaClassName: activeTab === 'crop' ? "border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" : "pointer-events-none opacity-0",
                  }}
                />

                {/* Overlays (Text and Tags) */}
                <div 
                  className="absolute inset-0 z-30 cursor-crosshair"
                  onClick={handleImageClick}
                >
                  {/* Text Layers Rendering */}
                  {textLayers.map((layer) => (
                    <motion.div
                      key={layer.id}
                      drag
                      dragMomentum={false}
                      onDragEnd={(_, info) => {
                        // Logic to update coordinates based on parent rect
                      }}
                      className={`absolute cursor-move select-none p-2 rounded-lg transition-all ${selectedTextId === layer.id ? 'ring-2 ring-indigo-500 bg-black/20' : ''}`}
                      style={{ 
                        left: `${layer.x}%`, 
                        top: `${layer.y}%`, 
                        transform: 'translate(-50%, -50%)',
                        color: layer.color,
                        fontSize: `${layer.size * 2}px`,
                        fontFamily: layer.font,
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTextId(layer.id);
                        setActiveTab('text');
                      }}
                    >
                      {layer.text}
                    </motion.div>
                  ))}

                  {/* Tags Rendering */}
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="absolute group"
                      style={{ left: `${tag.x}%`, top: `${tag.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <div className="w-4 h-4 bg-indigo-500 border-2 border-white rounded-full shadow-lg" />
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {tag.label}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setTags(tags.filter(t => t.id !== tag.id));
                          }}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR - TOOL SETTINGS */}
          <div className="w-[320px] bg-[#0f0f12]/70 backdrop-blur-2xl border-l border-white/10 flex flex-col p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'crop' && (
                <motion.div
                  key="crop"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Proporção do Corte</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { val: undefined, label: 'Livre', icon: Maximize2 },
                        { val: 1, label: 'Quadrado', icon: Square },
                        { val: 16 / 9, label: '16:9', icon: RectangleHorizontal },
                        { val: 4 / 5, label: '4:5', icon: RectangleVertical },
                      ].map((ratio) => (
                        <button
                          key={ratio.label}
                          onClick={() => setAspect(ratio.val)}
                          aria-pressed={aspect === ratio.val}
                          title={ratio.label}
                          className={`py-4 rounded-[24px] border flex flex-col items-center gap-2 transition-all active:scale-[0.98] ${aspect === ratio.val ? 'bg-indigo-500/15 border-indigo-400/50 text-white shadow-[0_12px_30px_rgba(99,102,241,0.18)]' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/15'}`}
                        >
                          <ratio.icon size={18} className={aspect === ratio.val ? 'text-indigo-300' : 'text-slate-400'} />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">{ratio.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Zoom da Imagem</label>
                    <div className="flex items-center gap-3 bg-white/5 p-4 rounded-[24px] border border-white/10 backdrop-blur-xl">
                      <button
                        type="button"
                        onClick={() => setZoom((z) => clamp(Number((z - 0.1).toFixed(2)), 1, 3))}
                        className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                        aria-label="Diminuir zoom"
                        title="Diminuir zoom"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 accent-indigo-500 h-1 rounded-full bg-white/10 appearance-none cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setZoom((z) => clamp(Number((z + 0.1).toFixed(2)), 1, 3))}
                        className="w-9 h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                        aria-label="Aumentar zoom"
                        title="Aumentar zoom"
                      >
                        <ZoomIn size={16} />
                      </button>
                      <span className="w-12 text-right text-[11px] font-black text-slate-300 tabular-nums">
                        {zoom.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'rotate' && (
                <motion.div
                  key="rotate"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Girar Imagem</label>
                      <span className="text-[11px] font-black text-indigo-300 tabular-nums">{rotation}°</span>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[24px] border border-white/10 backdrop-blur-xl">
                      <RotateCw size={16} className="text-slate-400" />
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={1}
                        value={rotation}
                        onChange={(e) => setRotation(Number(e.target.value))}
                        className="flex-1 accent-indigo-500 h-1 rounded-full bg-white/10 appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setRotation((r) => (r + 90) % 360)} className="py-4 rounded-[24px] bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all font-black text-[12px] uppercase tracking-[0.2em] active:scale-[0.98]">
                      +90°
                    </button>
                    <button onClick={() => setRotation(0)} className="py-4 rounded-[24px] bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all font-black text-[12px] uppercase tracking-[0.2em] active:scale-[0.98]">
                      Resetar
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'adjust' && (
                <motion.div
                  key="adjust"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {[
                    { label: 'Brilho', val: brightness, setter: setBrightness, icon: Sun },
                    { label: 'Contraste', val: contrast, setter: setContrast, icon: Contrast },
                    { label: 'Saturação', val: saturation, setter: setSaturation, icon: Droplets },
                  ].map((adj) => (
                    <div key={adj.label} className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2 text-slate-400">
                          <adj.icon size={14} />
                          <label className="text-[11px] font-black uppercase tracking-[0.2em]">{adj.label}</label>
                        </div>
                        <span className="text-[11px] font-black text-indigo-300 tabular-nums">{adj.val}%</span>
                      </div>
                      <div className="bg-white/5 p-4 rounded-[24px] border border-white/10 backdrop-blur-xl">
                        <input
                          type="range"
                          min={0}
                          max={200}
                          value={adj.val}
                          onChange={(e) => adj.setter(Number(e.target.value))}
                          className="w-full accent-indigo-500 h-1 rounded-full bg-white/10 appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'alt' && (
                <motion.div
                  key="alt"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h4 className="text-[14px] font-bold text-white">Texto Alternativo</h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      O texto alternativo descreve o conteúdo de suas fotos para pessoas com deficiências visuais e melhora o SEO do seu post.
                    </p>
                    <textarea
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Descreva esta imagem..."
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-[24px] p-4 text-white text-[14px] outline-none focus:border-indigo-400 transition-all resize-none backdrop-blur-xl"
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === 'tag' && (
                <motion.div
                  key="tag"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h4 className="text-[14px] font-bold text-white">Marcar Pessoas</h4>
                    <p className="text-[12px] text-slate-500 leading-relaxed">
                      Clique em qualquer lugar da imagem para adicionar uma marcação.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {tags.length === 0 ? (
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-[24px] p-8 text-center backdrop-blur-xl">
                        <p className="text-[11px] text-slate-400 uppercase font-black tracking-[0.2em]">Nenhuma marcação</p>
                      </div>
                    ) : (
                      tags.map((tag) => (
                        <div key={tag.id} className="bg-white/5 border border-white/10 p-4 rounded-[24px] flex flex-col gap-3 backdrop-blur-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Tag #{tag.id.toString().slice(-4)}</span>
                            <button onClick={() => setTags(tags.filter(t => t.id !== tag.id))} className="text-white/40 hover:text-red-400 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                          <input
                            value={tag.label}
                            onChange={(e) => setTags(tags.map(t => t.id === tag.id ? { ...t, label: e.target.value } : t))}
                            className="bg-black/20 border border-white/10 rounded-[18px] px-3 py-2 text-[12px] text-white outline-none focus:border-indigo-400 backdrop-blur-xl"
                            placeholder="Nome da pessoa..."
                          />
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'text' && (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[14px] font-bold text-white">Camadas de Texto</h4>
                    <button
                      onClick={addTextLayer}
                      className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full transition-all shadow-[0_10px_30px_rgba(99,102,241,0.22)] active:scale-[0.98] inline-flex items-center gap-2"
                    >
                      <Sparkles size={14} />
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-4">
                    {textLayers.length === 0 ? (
                      <div className="bg-white/5 border border-dashed border-white/10 rounded-[24px] p-8 text-center backdrop-blur-xl">
                        <p className="text-[11px] text-slate-400 uppercase font-black tracking-[0.2em]">Nenhum texto adicionado</p>
                      </div>
                    ) : (
                      textLayers.map((layer) => (
                        <div 
                          key={layer.id} 
                          className={`bg-white/5 border transition-all p-4 rounded-[24px] space-y-4 backdrop-blur-xl ${selectedTextId === layer.id ? 'border-indigo-400/50 bg-indigo-500/10 shadow-[0_18px_50px_rgba(99,102,241,0.12)]' : 'border-white/10'}`}
                          onClick={() => setSelectedTextId(layer.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Layer: {layer.text.slice(0, 10)}...</span>
                            <button onClick={() => removeTextLayer(layer.id)} className="text-white/40 hover:text-red-400 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                          
                          <input
                            value={layer.text}
                            onChange={(e) => updateTextLayer(layer.id, { text: e.target.value })}
                            className="w-full bg-black/20 border border-white/10 rounded-[18px] px-3 py-2 text-[13px] text-white outline-none focus:border-indigo-400 backdrop-blur-xl"
                            placeholder="Seu texto aqui..."
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Tamanho</label>
                              <input
                                type="range"
                                min={5}
                                max={50}
                                value={layer.size}
                                onChange={(e) => updateTextLayer(layer.id, { size: Number(e.target.value) })}
                                className="w-full accent-indigo-500 h-1 rounded-full bg-white/10 appearance-none cursor-pointer"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Cor</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={layer.color}
                                  onChange={(e) => updateTextLayer(layer.id, { color: e.target.value })}
                                  className="w-8 h-8 rounded-[12px] bg-transparent border-none cursor-pointer"
                                />
                                <span className="text-[10px] text-white/60 font-mono uppercase">{layer.color}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Posição Y (%)</label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={layer.y}
                              onChange={(e) => updateTextLayer(layer.id, { y: Number(e.target.value) })}
                              className="w-full accent-indigo-500 h-1 rounded-full bg-white/10 appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
