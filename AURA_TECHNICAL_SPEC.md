# 🧠 Aura Social: Enciclopédia Técnica e Funcional (Master Spec)

Este documento é a especificação definitiva da Aura Social, validada diretamente contra o código-fonte. Ele detalha o comportamento de cada botão, regra de negócio, integração Firebase e nuances de UX.

---

## 🔐 1. Autenticação e Onboarding
O sistema de entrada foca em segurança em tempo real e transição suave.

*   **Provedores:** Google Sign-In e Email/Senha gerenciados pelo `AuthProvider`.
*   **Estado isAuthReady:** Um semáforo global no `useAppStore` que impede flashes de conteúdo antes da resolução do Firebase.
*   **Segurança em Tempo Real:** O `AuthProvider` mantém um `onSnapshot` no perfil do usuário logado. Se o campo `isBanned` for marcado como `true`, a sessão é **terminada instantaneamente** via `signOut`.
*   **Username Auto-Geração:** Se um usuário novo não definir um username, o sistema gera um baseado no email + sufixo randômico.
*   **Presença (Heartbeat):** O sistema envia um sinal de vida a cada 60 segundos, atualizando `lastActive` e `isOnline: true` no Firestore.

---

## 📝 2. O Post Card (Unidade de Interação)
O componente `PostCard` gerencia dezenas de estados e interações.

### **Composição e Menu de Opções (...)**
*   **Header:** Foto, Nome (com Link p/ Perfil), Badge de Verificação (calculado por ID ou status manual), Mood (Emoji + Texto) e Visibilidade (Globo/Comunidade).
*   **Menu de Opções:**
    *   `Excluir Post`: Visível para autor, moderadores da comunidade ou administradores globais.
    *   `Fixar/Desafixar no topo`: Disponível para moderadores dentro do contexto de uma comunidade.
    *   `Denunciar`: Abre modal de reporte para auditoria.

### **Interações e Gestos**
*   **Double-Tap/Click:** Toque duplo na imagem ou vídeo dispara uma animação de coração gigante (`HeartOverlay`) e adiciona um Like automaticamente.
*   **Barra de Reações (Hold/Hover):** Exibe 7 reações: 👍 Like, ❤️ Love, 😂 Funny, 😮 Wow, 😢 Sad, 😡 Angry, 🔥 Fire.
*   **Sanity Check (Anti-NaN):** Utiliza a função `parseCount` para garantir que métricas corrompidas no Firebase nunca exibam "NaN" na interface, forçando `0` como fallback.
*   **Likers Stack:** Exibe fotos dos últimos usuários que reagiram, com contador residual (ex: +12).

---

## 💬 3. Sistema de Chat e Comunicação
Infraestrutura de mensagens síncronas de alta densidade.

*   **Chat Hub:** Lista de conversas com preview de última mensagem e status de leitura (`readBy`).
*   **Indicador de Digitação:** Sincronizado via campo `typingUsers` no documento do chat. Ativado ao focar o input e removido após 3s de inatividade.
*   **Chamadas WebRTC:**
    *   **Sinalização:** Usa o `SignalingProvider` via Firestore para trocar Offer/Answer.
    *   **CallManager:** Interface full-screen com controles de Mudo, Câmera e um botão **X** de encerramento rápido.
    *   **Tratamento de Erros:** Exibe barras de erro vermelhas se a câmera/microfone não forem detectados.

---

## 🎞️ 4. Stories e Conteúdo Efêmero
*   **Expiração:** Implementada via regras de segurança que validam o campo `expiresAt` (24h após criação).
*   **Navegação:** Toque lateral para avançar/retroceder.
*   **Views Tracking:** Lista em tempo real quem visualizou, filtrada pelo autor do story.

---

## 🧭 5. Navegação e Busca (TopNav)
*   **Atalhos:** Tecla `/` abre instantaneamente o `SearchOverlay`.
*   **Busca Preditiva:** O overlay sugere hashtags populares e perfis enquanto o usuário digita.
*   **Focus Mode:** Botão de toggle que simplifica a UI para leitura imersiva.
*   **Dropdowns Inteligentes:** `ProfileDropdown` contém links para Configurações, Ajuda, Acessibilidade e um botão de Logout com confirmação.

---

## 🏘️ 6. Comunidades e Governança
*   **Join Gate:** Bloqueia conteúdo de comunidades privadas até que o usuário seja aceito.
*   **Moderação:** Fila de aprovação de posts (`approvalStatus`) configurável por comunidade.
*   **Tags e Interesses:** Comunidades categorizadas para alimentar o algoritmo de descoberta.

---

## 🔊 7. Efeitos Sonoros e Feedback (UX)
Aura utiliza o sistema `SoundEffects` com os seguintes gatilhos:
*   `pop`: Ao receber mensagens ou abrir modais leves.
*   `reaction`: Ao selecionar um emoji na barra de reações.
*   `success`: Ao enviar um post com sucesso (volume sutil: 0.15).
*   `notification`: Chime clássico para novos alertas no TopNav.
*   `delete`: Som de "crunch" ao remover conteúdo.

---

## 🛡️ 8. Regras de Dados (Motor Firebase)
*   **Firestore Rules:** Mais de 1200 linhas de proteção. Valida esquemas de dados, tipos de string e impede incrementos ilegais de métricas.
*   **Storage Rules:** Garante que mídias de posts sejam acessíveis apenas por usuários autenticados e editáveis apenas pelo autor.
*   **Coleção user_search:** Índice espelho leve para buscas rápidas sem carregar perfis completos.

---

*Documento de Auditoria Técnica e Funcional - Aura v2.2 - Abril 2026*
