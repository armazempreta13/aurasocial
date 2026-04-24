# 🌌 Aura Social: Design System & Frontend Specification

Este documento define a identidade visual, os padrões de interface (UI) e a experiência do usuário (UX) da plataforma **Aura Social**. Ele serve como guia mestre para o desenvolvimento Web e transposição para Mobile (Android/iOS).

---

## 🚀 1. Visão de Marca
A Aura Social não é apenas uma rede de mensagens; é uma camada de interação "viva". O design foca em **densidade de informação**, **transparência (glassmorphism)** e **fluidez**.

*   **Palavras-chave:** Premium, Futurista, Orgânico, Energético.

---

## 🎨 2. Sistema de Cores (The Aura Palette)

### 🌑 Core Dark (Base)
A Aura utiliza um "Dark Mode" profundo que evita o preto puro (`#000`) para manter o contraste suave e elegante.
*   **Background Principal:** `#0f0f12` (Deep Charcoal)
*   **Cards/Containers:** `rgba(255, 255, 255, 0.05)` com Blur de 20px.
*   **Bordas:** `rgba(255, 255, 255, 0.08)` (Subtle White Stroke)

### 🌈 Acentos e Estados
*   **Primary (Action):** `#6366f1` (Indigo vibrante) — Usado para botões principais e links.
*   **Success/Online:** `#10b981` (Emerald Green) — Status de presença e confirmações.
*   **Alert/Notification:** `#f43f5e` (Rose Red) — Badges de mensagens não lidas e botões de encerrar.
*   **Warning/Gold:** `#f59e0b` (Amber) — Elementos de destaque e verificação.

---

## 📐 3. Tokens de Design (Design Tokens)

### Arredondamento (Border Radius)
A Aura possui uma identidade "super-rounded", fugindo dos cantos quadrados tradicionais.
*   **Cards de Post:** `40px` (Extremamente arredondado)
*   **Botões e Inputs:** `full` (Pílula) ou `20px` (Soft square).
*   **Modais/Painéis:** `28px` a `32px`.

### Glassmorphism (Efeito Vidro)
Todos os elementos flutuantes devem utilizar:
*   `backdrop-filter: blur(20px) saturate(180%)`
*   `background: rgba(15, 15, 18, 0.7)` para painéis escuros.
*   `background: rgba(255, 255, 255, 0.05)` para cards leves.

---

## ✍️ 4. Tipografia
Foco em legibilidade e hierarquia moderna.
*   **Fonte Principal:** `Outfit` (ou `Inter` como fallback).
*   **Títulos (H1, H2):** `Font-black`, `tracking-tight`.
*   **Corpo de Texto:** `Font-medium`, cor `slate-400` para descrições e `white` para conteúdo principal.
*   **Legendas:** Uppercase, `tracking-[0.2em]`, `font-bold`, tamanho reduzido (11px-12px).

---

## 🧩 5. Arquitetura de Componentes Frontend

### **PostCard (O Coração do Feed)**
*   **Sanity Check:** Todas as métricas (curtidas, comentários) passam por um tratamento anti-NaN (`parseCount`).
*   **Interações:** Sistema de reações múltiplas (Amei, Haha, Wow) com contadores dinâmicos.
*   **Avatares:** Exibição em pilha (Stack) com bordas brancas de separação.

### **CallManager (WebRTC UI)**
*   **Experiência:** Transição suave com `framer-motion`.
*   **Feedback:** Barra de erro em Rose Red com texto em branco quando dispositivos não são encontrados.
*   **Controle:** Botão de fechar (X) sempre disponível no topo direito para cancelamento instantâneo.

### **Chat System**
*   **Floating Windows:** Até 2 chats flutuantes simultâneos no desktop.
*   **Real-time:** Integração via Firestore `onSnapshot` para mensagens e `sendTyping` para indicadores de digitação.
*   **Context:** `currentChat` sempre disponível globalmente no provider.

---

## 📱 6. Estratégia de Transposição Mobile (Android/iOS)

Ao converter para Android, as seguintes adaptações são mandatórias:
1.  **Navegação:** Substituir menus laterais por uma **Bottom Navigation Bar** flutuante.
2.  **Gestos:** Implementar "Swipe to Reply" nas mensagens e "Double Tap to Like" no feed.
3.  **Haptics:** Feedback tátil em todas as reações e envio de mensagens.
4.  **Bottom Sheets:** Usar painéis deslizantes de baixo para cima para Info de Chat e Configurações de Post.

---

## ✨ 7. Princípios de Animação
*   **Duração Padrão:** `300ms`
*   **Curva de Timing:** `cubic-bezier(0.4, 0, 0.2, 1)` (Entrada rápida, saída suave).
*   **Micro-interações:** Botões reduzem de escala para `0.95` ao serem pressionados.
*   **Entrada de Elementos:** Fade-in com leve deslocamento para cima (Y: 20px -> 0).

---

*Documento Gerado pela IA Antigravity - 2026*
