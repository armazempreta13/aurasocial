const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'lib/locales/en/common.json');
const ptPath = path.join(__dirname, 'lib/locales/pt-BR/common.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));

if (!enJson.profile_page) enJson.profile_page = {};
if (!ptJson.profile_page) ptJson.profile_page = {};

const newEnKeys = {
  "tab_likes": "Likes",
  "tab_followers": "Followers",
  "tab_following": "Following",
  "edit_details": "Edit details",
  "no_details": "No details provided yet.",
  "lives_in": "Lives in",
  "works_at": "Works at",
  "studied_at": "Studied at",
  "shared_communities": "shared communities",
  "affinity": "Affinity"
};

const newPtKeys = {
  "tab_likes": "Curtidas",
  "tab_followers": "Seguidores",
  "tab_following": "Seguindo",
  "edit_details": "Editar detalhes",
  "no_details": "Nenhum detalhe fornecido ainda.",
  "lives_in": "Mora em",
  "works_at": "Trabalha em",
  "studied_at": "Estudou em",
  "shared_communities": "comunidades em comum",
  "affinity": "Afinidade"
};

Object.assign(enJson.profile_page, newEnKeys);
Object.assign(ptJson.profile_page, newPtKeys);

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf-8');
fs.writeFileSync(ptPath, JSON.stringify(ptJson, null, 2), 'utf-8');

console.log('Profile Page Translations updated with more keys!');
