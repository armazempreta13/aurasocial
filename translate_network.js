const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'lib/locales/en/common.json');
const ptPath = path.join(__dirname, 'lib/locales/pt-BR/common.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));

const newEnKeys = {
  "network_page": {
    "title": "Network",
    "subtitle": "Grow your professional circle",
    "search_placeholder": "Search people by name or interest...",
    "people_you_may_know": "People you may know",
    "friend_requests": "Friend Requests",
    "friend_requests_desc": "Respond quickly to people who already share context with you.",
    "wants_to_connect": "Wants to connect with you.",
    "accept": "Accept",
    "decline": "Decline",
    "ignore": "Ignore",
    "friends": "Friends",
    "request_sent": "Request Sent",
    "blocked": "Blocked",
    "add_friend": "Add Friend",
    "following": "Following",
    "follow": "Follow",
    "aura_member": "Aura Member",
    "optional_message": "Optional message for this friend request:",
    "failed_send": "Failed to send friend request.",
    "failed_update": "Failed to update request."
  }
};

const newPtKeys = {
  "network_page": {
    "title": "Networking",
    "subtitle": "Expanda sua rede social e conexões",
    "search_placeholder": "Buscar pessoas por nome ou interesse...",
    "people_you_may_know": "Pessoas que talvez você conheça",
    "friend_requests": "Solicitações de Amizade",
    "friend_requests_desc": "Responda rapidamente a pessoas que desejam se conectar com você.",
    "wants_to_connect": "Quer se conectar com você.",
    "accept": "Aceitar",
    "decline": "Recusar",
    "ignore": "Ignorar",
    "friends": "Amigos",
    "request_sent": "Enviado",
    "blocked": "Bloqueado",
    "add_friend": "Adicionar",
    "following": "Seguindo",
    "follow": "Seguir",
    "aura_member": "Membro Aura",
    "optional_message": "Mensagem opcional para esta solicitação:",
    "failed_send": "Falha ao enviar a solicitação.",
    "failed_update": "Falha ao atualizar a solicitação."
  }
};

Object.assign(enJson, newEnKeys);
Object.assign(ptJson, newPtKeys);

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf-8');
fs.writeFileSync(ptPath, JSON.stringify(ptJson, null, 2), 'utf-8');

console.log('Network Translations updated successfully!');
