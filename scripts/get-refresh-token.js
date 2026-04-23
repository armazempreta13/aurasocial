const { google } = require('googleapis');
require('dotenv').config();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground'; // Common helper

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET missing in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent'
});

console.log('------------------------------------------------------------------');
console.log('PASSO 1: Acesse a URL abaixo no seu navegador:');
console.log('------------------------------------------------------------------');
console.log(url);
console.log('------------------------------------------------------------------');
console.log('\nPASSO 2: Autorize o acesso e você será redirecionado.');
console.log('Copie o parâmetro "code" da URL de redirecionamento.');
console.log('\nPASSO 3: Me envie esse código aqui no chat para eu gerar o seu REFRESH_TOKEN.');
console.log('------------------------------------------------------------------');
