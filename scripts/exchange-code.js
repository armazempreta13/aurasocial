const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

const code = process.argv[2];

if (!code) {
  console.error('Error: Please provide the authorization code as an argument.');
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET missing in .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

async function exchange() {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('------------------------------------------------------------------');
    console.log('SUCESSO! Tokens gerados:');
    console.log('------------------------------------------------------------------');
    console.log('REFRESH TOKEN:', tokens.refresh_token);
    console.log('------------------------------------------------------------------');
    
    if (tokens.refresh_token) {
        // Automatically update .env
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        if (envContent.includes('YOUTUBE_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/YOUTUBE_REFRESH_TOKEN=.*/, `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
        } else {
            envContent += `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
        }
        
        fs.writeFileSync(envPath, envContent);
        console.log('.env atualizado com sucesso!');
    } else {
        console.log('\nAVISO: O Google não enviou um Refresh Token novo.');
        console.log('Isso acontece se você já autorizou este app antes.');
        console.log('Tente remover o acesso em https://myaccount.google.com/permissions e tente de novo.');
    }
  } catch (error) {
    console.error('Erro ao trocar o código:', error.message);
  }
}

exchange();
