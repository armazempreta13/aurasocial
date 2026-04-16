const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'lib/locales/en/common.json');
const ptPath = path.join(__dirname, 'lib/locales/pt-BR/common.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));

if (!enJson.relationship) enJson.relationship = {};
if (!ptJson.relationship) ptJson.relationship = {};

const newEnKeys = {
  "friends": "Friends",
  "request_sent": "Request Sent",
  "request_received": "Request Received",
  "blocked": "Blocked",
  "muted": "Muted",
  "none": "No connection"
};

const newPtKeys = {
  "friends": "Amigos",
  "request_sent": "Convite Enviado",
  "request_received": "Convite Recebido",
  "blocked": "Bloqueado",
  "muted": "Silenciado",
  "none": "Sem conexão"
};

Object.assign(enJson.relationship, newEnKeys);
Object.assign(ptJson.relationship, newPtKeys);

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf-8');
fs.writeFileSync(ptPath, JSON.stringify(ptJson, null, 2), 'utf-8');

console.log('Relationship statuses translated!');
