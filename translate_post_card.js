const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'lib/locales/en/common.json');
const ptPath = path.join(__dirname, 'lib/locales/pt-BR/common.json');

const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const ptJson = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));

if (!enJson.post_card) enJson.post_card = {};
if (!ptJson.post_card) ptJson.post_card = {};

const newEnKeys = {
  "share_to_feed": "Share to my feed",
  "share_externally": "Share externally",
  "copy_link": "Copy link",
  "add_caption": "Add a caption to your share (optional):",
  "shared_a_post": "Shared a post",
  "post_shared": "Post shared to your feed.",
  "failed_to_share": "Failed to share post:",
  "link_copied": "Post link copied to clipboard.",
  "check_out": "Check out this post on Aura.",
  "delete": "Delete Post",
  "report": "Report Post",
  "report_confirm": "Are you sure you want to report this post for moderation?",
  "post_reported": "Post reported successfully.",
  "failed_to_report": "Failed to report:",
  "delete_confirm": "Are you sure you want to delete this post?",
  "failed_to_delete": "Failed to delete post:",
  "failed_to_react": "Failed to react:",
  "failed_to_add_comment": "Failed to add comment:",
  "in": "in"
};

const newPtKeys = {
  "share_to_feed": "Compartilhar no meu feed",
  "share_externally": "Compartilhar externamente",
  "copy_link": "Copiar link",
  "add_caption": "Adicione uma legenda ao seu compartilhamento (opcional):",
  "shared_a_post": "Compartilhou um post",
  "post_shared": "Post compartilhado no seu feed.",
  "failed_to_share": "Falha ao compartilhar o post:",
  "link_copied": "Link do post copiado para a área de transferência.",
  "check_out": "Dê uma olhada neste post na Aura.",
  "delete": "Excluir Post",
  "report": "Denunciar Post",
  "report_confirm": "Tem certeza que deseja denunciar este post para moderação?",
  "post_reported": "Post denunciado com sucesso.",
  "failed_to_report": "Falha ao denunciar:",
  "delete_confirm": "Tem certeza que deseja excluir este post?",
  "failed_to_delete": "Falha ao excluir post:",
  "failed_to_react": "Falha ao reagir:",
  "failed_to_add_comment": "Falha ao adicionar comentário:",
  "in": "em"
};

Object.assign(enJson.post_card, newEnKeys);
Object.assign(ptJson.post_card, newPtKeys);

fs.writeFileSync(enPath, JSON.stringify(enJson, null, 2), 'utf-8');
fs.writeFileSync(ptPath, JSON.stringify(ptJson, null, 2), 'utf-8');

console.log('PostCard Translations updated successfully!');
