'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Save, Loader2, Image as ImageIcon, Link2, Tag, Paintbrush, Upload } from 'lucide-react';
import Image from 'next/image';
import { uploadImage } from '@/lib/image-utils';
import {
  buildCommunityCoverStyle,
  COMMUNITY_THEME_PRESETS,
  DEFAULT_COMMUNITY_THEME,
  normalizeThemeColor,
} from '@/lib/community-theme';

const EMPTY_LINK = { label: '', url: '' };

export default function CommunityAdminGeneralPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      const docSnap = await getDoc(doc(db, 'communities', id as string));
      if (docSnap.exists()) {
        const payload = docSnap.data() as any;
        setData({
          ...payload,
          themeColor: normalizeThemeColor(payload.themeColor),
          pinnedTopics:
            Array.isArray(payload.pinnedTopics) && payload.pinnedTopics.length > 0
              ? [...payload.pinnedTopics, ...Array.from({ length: Math.max(0, 5 - payload.pinnedTopics.length) }, () => '')].slice(0, 5)
              : ['', '', ''],
          links:
            Array.isArray(payload.links) && payload.links.length > 0
              ? payload.links.slice(0, 3)
              : [{ ...EMPTY_LINK }],
        });
      }
      setLoading(false);
    };
    void fetchDoc();
  }, [id]);

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'coverURL' | 'image',
  ) => {
    const file = event.target.files?.[0];
    if (!file || !data) return;

    if (target === 'coverURL') setIsUploadingCover(true);
    if (target === 'image') setIsUploadingAvatar(true);

    try {
      const result = await uploadImage(file);
      setData((current: any) => ({ ...current, [target]: result.url }));
    } catch (error) {
      console.error(error);
      alert('Não foi possível enviar a imagem agora.');
    } finally {
      if (target === 'coverURL') setIsUploadingCover(false);
      if (target === 'image') setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'communities', id as string), {
        name: data.name,
        description: data.description,
        type: data.type,
        image: data.image || '',
        coverURL: data.coverURL || '',
        themeColor: normalizeThemeColor(data.themeColor),
        pinnedTopics: (data.pinnedTopics || [])
          .map((topic: string) => topic.trim())
          .filter(Boolean)
          .slice(0, 5),
        links: (data.links || [])
          .map((link: { label: string; url: string }) => ({
            label: link.label.trim(),
            url: link.url.trim(),
          }))
          .filter((link: { label: string; url: string }) => link.label && link.url)
          .slice(0, 3),
        updatedAt: serverTimestamp(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error(error);
      alert('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Identidade da comunidade</h1>
        <p className="mt-1 text-muted-foreground">
          Ajuste presença visual, contexto e os sinais que ajudam a comunidade a parecer um lugar de verdade.
        </p>
      </div>

      <div className="space-y-8 rounded-3xl border border-border/50 bg-white p-8 shadow-sm">
        <div>
          <h3 className="mb-4 text-lg font-bold text-foreground">Aparência</h3>
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div
                className="relative h-52 overflow-hidden rounded-[28px] border border-border/50"
                style={!data.coverURL ? buildCommunityCoverStyle(data.themeColor) : undefined}
              >
                {data.coverURL ? (
                  <Image src={data.coverURL} alt="" fill sizes="800px" className="object-cover" referrerPolicy="no-referrer" />
                ) : null}
                {isUploadingCover && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
              >
                <Upload className="h-4 w-4" />
                {data.coverURL ? 'Trocar capa' : 'Enviar capa'}
              </button>
              <input
                type="file"
                ref={coverInputRef}
                onChange={(event) => handleUpload(event, 'coverURL')}
                className="hidden"
                accept="image/*"
              />
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <ImageIcon className="h-4 w-4" />
                  Avatar
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-[26px] border border-border/50 bg-muted">
                    {data.image ? (
                      <Image src={data.image} alt="" fill sizes="96px" className="object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-black text-primary">
                        {(data.name || 'A').charAt(0)}
                      </div>
                    )}
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-xl bg-muted px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted/80"
                  >
                    Trocar avatar
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={(event) => handleUpload(event, 'image')}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <Paintbrush className="h-4 w-4" />
                  Cor temática
                </label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {COMMUNITY_THEME_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setData((current: any) => ({ ...current, themeColor: color }))}
                      className={`h-9 w-9 rounded-full border-2 transition-all ${
                        normalizeThemeColor(data.themeColor) === color
                          ? 'scale-110 border-foreground/30'
                          : 'border-white'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={data.themeColor || DEFAULT_COMMUNITY_THEME}
                  onChange={(e) =>
                    setData((current: any) => ({ ...current, themeColor: e.target.value }))
                  }
                  className="w-full rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm uppercase transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block font-semibold text-foreground">Nome da comunidade</label>
            <input
              type="text"
              value={data.name || ''}
              onChange={(e) => setData((current: any) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-xl border border-border/50 bg-muted/30 p-4 font-medium text-foreground transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="mb-2 block font-semibold text-foreground">Descrição</label>
            <textarea
              value={data.description || ''}
              onChange={(e) =>
                setData((current: any) => ({ ...current, description: e.target.value }))
              }
              rows={4}
              className="w-full resize-none rounded-xl border border-border/50 bg-muted/30 p-4 text-foreground transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Essa descrição aparece antes do feed e ajuda a explicar o contexto da comunidade.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Tag className="h-4 w-4" />
              Tópicos fixos
            </label>
            <div className="space-y-2">
              {(data.pinnedTopics || []).map((topic: string, index: number) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Tópico ${index + 1}`}
                  value={topic}
                  onChange={(e) => {
                    const nextTopics = [...(data.pinnedTopics || [])];
                    nextTopics[index] = e.target.value;
                    setData((current: any) => ({ ...current, pinnedTopics: nextTopics }));
                  }}
                  className="w-full rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold text-foreground">
                <Link2 className="h-4 w-4" />
                Links úteis
              </label>
              {(data.links || []).length < 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setData((current: any) => ({
                      ...current,
                      links: [...(current.links || []), { ...EMPTY_LINK }],
                    }))
                  }
                  className="text-xs font-bold text-primary"
                >
                  Adicionar link
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(data.links || []).map((link: { label: string; url: string }, index: number) => (
                <div key={index} className="grid gap-2 md:grid-cols-[0.8fr_1.2fr_auto]">
                  <input
                    type="text"
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) => {
                      const nextLinks = [...(data.links || [])];
                      nextLinks[index] = { ...nextLinks[index], label: e.target.value };
                      setData((current: any) => ({ ...current, links: nextLinks }));
                    }}
                    className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => {
                      const nextLinks = [...(data.links || [])];
                      nextLinks[index] = { ...nextLinks[index], url: e.target.value };
                      setData((current: any) => ({ ...current, links: nextLinks }));
                    }}
                    className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm transition-all focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/10"
                  />
                  {(data.links || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setData((current: any) => ({
                          ...current,
                          links: (current.links || []).filter((_: any, linkIndex: number) => linkIndex !== index),
                        }))
                      }
                      className="rounded-xl px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6">
          <h3 className="mb-4 text-lg font-bold text-foreground">Privacidade</h3>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/50 p-4 transition-colors hover:bg-muted/30">
              <input
                type="radio"
                name="visibility"
                value="Public"
                checked={data.type === 'Public'}
                onChange={() => setData((current: any) => ({ ...current, type: 'Public' }))}
                className="h-5 w-5 text-primary"
              />
              <div>
                <div className="font-bold text-foreground">Comunidade pública</div>
                <div className="text-sm text-muted-foreground">
                  Usuários autenticados conseguem descobrir a comunidade e ver uma prévia do ambiente.
                </div>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-border/50 p-4 transition-colors hover:bg-muted/30">
              <input
                type="radio"
                name="visibility"
                value="Private"
                checked={data.type === 'Private'}
                onChange={() => setData((current: any) => ({ ...current, type: 'Private' }))}
                className="h-5 w-5 text-primary"
              />
              <div>
                <div className="font-bold text-foreground">Comunidade privada</div>
                <div className="text-sm text-muted-foreground">
                  A entrada depende de aprovação e o conteúdo fica protegido para membros.
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 py-4">
        {saveSuccess && <span className="font-medium text-emerald-600">Alterações salvas com sucesso.</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-bold text-white shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}
