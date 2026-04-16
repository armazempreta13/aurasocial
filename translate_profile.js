const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'lib/locales/en/common.json');
const ptPath = path.join(__dirname, 'lib/locales/pt-BR/common.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));

const newEnKeys = {
  "profile_page": {
    "loading": "Loading...",
    "user_not_found": "User not found",
    "accept_request": "Accept Request",
    "cancel_request": "Cancel Request",
    "friends": "Friends",
    "muted_friend": "Muted Friend",
    "blocked": "Blocked",
    "add_friend": "Add Friend",
    "default_bio": "Exploring the digital frontier. Passionate about design, technology, and building communities. 🚀",
    "joined": "Joined",
    "recently": "Recently",
    "working": "Working...",
    "message": "Message",
    "following": "Following",
    "follow": "Follow",
    "edit_profile": "Edit Profile",
    "decline_request": "Decline request",
    "ignore_quietly": "Ignore quietly",
    "unmute_friend": "Unmute friend",
    "mute_friend": "Mute friend",
    "remove_restriction": "Remove restriction",
    "restrict_user": "Restrict user",
    "unblock_user": "Unblock user",
    "block_user": "Block user",
    "relationship_status": "Relationship Settings",
    "tab_posts": "Posts",
    "tab_photos": "Photos",
    "tab_followers": "Followers",
    "tab_following": "Following",
    "no_posts": "No posts yet",
    "no_posts_desc": "When there are posts, they will show up here.",
    "intro": "Intro",
    "friends_count": "Friends",
    "see_all_photos": "See all photos"
  }
};

const newPtKeys = {
  "profile_page": {
    "loading": "Carregando...",
    "user_not_found": "Usuário não encontrado",
    "accept_request": "Aceitar",
    "cancel_request": "Cancelar",
    "friends": "Amigos",
    "muted_friend": "Amigo Silenciado",
    "blocked": "Bloqueado",
    "add_friend": "Adicionar Amigo",
    "default_bio": "Explorando a fronteira digital. Apaixonado por design, tecnologia e comunidades. 🚀",
    "joined": "Entrou em",
    "recently": "Recentemente",
    "working": "Carregando...",
    "message": "Mensagem",
    "following": "Seguindo",
    "follow": "Seguir",
    "edit_profile": "Editar Perfil",
    "decline_request": "Recusar",
    "ignore_quietly": "Ignorar",
    "unmute_friend": "Ativar notificações",
    "mute_friend": "Silenciar amigo",
    "remove_restriction": "Remover restrição",
    "restrict_user": "Restringir usuário",
    "unblock_user": "Desbloquear",
    "block_user": "Bloquear usuário",
    "relationship_status": "Configurações de Relacionamento",
    "tab_posts": "Criações",
    "tab_photos": "Fotos",
    "tab_followers": "Seguidores",
    "tab_following": "Seguindo",
    "no_posts": "Nenhuma publicação ainda",
    "no_posts_desc": "Quando houver publicações, elas aparecerão aqui.",
    "intro": "Sobre",
    "friends_count": "Amigos",
    "see_all_photos": "Ver todas as fotos"
  }
};

Object.assign(enJson, newEnKeys);
Object.assign(ptJson, newPtKeys);

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf-8');
fs.writeFileSync(ptPath, JSON.stringify(ptJson, null, 2), 'utf-8');

console.log('Profile Translations updated successfully!');
