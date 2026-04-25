import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import firebaseConfig from '@/firebase-applet-config.json';

export async function POST(request: Request) {
  try {
    const { email, uid, idToken } = await request.json();

    if (!email || !uid || !idToken) {
      return NextResponse.json({ error: 'E-mail, UID e Token são obrigatórios.' }, { status: 400 });
    }

    // 1. Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[OTP DEBUG] Código gerado para ${email}: ${code}`);

    // Salvar temporariamente o código puro em um arquivo acessível no filesystem
    try {
      const debugPath = path.join(process.cwd(), 'otp_debug.json');
      fs.writeFileSync(debugPath, JSON.stringify({ email, code, uid, expiresAt: Date.now() + 5 * 60 * 1000 }, null, 2));
    } catch (fsErr) {
      console.error('Erro ao salvar otp_debug.json:', fsErr);
    }



    // 2. Criar Hash do código (SHA-256)
    const hash = crypto.createHash('sha256').update(code).digest('hex');

    // 3. Definir Expiração (5 minutos)
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // 4. Salvar Hash no documento do usuário via Firestore REST API
    const projectId = firebaseConfig.projectId;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=otpHash&updateMask.fieldPaths=otpExpiresAt`;

    const restResponse = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          otpHash: { stringValue: hash },
          otpExpiresAt: { integerValue: expiresAt.toString() }
        }
      })
    });

    if (!restResponse.ok) {
      const errData = await restResponse.json().catch(() => ({}));
      console.error('Erro ao gravar no Firestore REST API:', errData);
      return NextResponse.json({ error: 'Falha ao persistir os dados do código.' }, { status: 500 });
    }



    // 5. Enviar e-mail Real usando a API da Resend
    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY || 're_KnSCZYcd_Kyu12hRahfCF8nKU3mWGAqRj'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'Aura Social <noreply@aurasocial.top>',

          to: email,
          subject: `${code} é o seu código de verificação Aura`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 20px; color: #1f2937;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="padding: 24px; border-bottom: 1px solid #f3f4f6;">
                  <div style="display: inline-block; vertical-align: middle; width: 32px; height: 32px; background: linear-gradient(135deg, #6f63dd 0%, #a855f7 100%); border-radius: 50%; margin-right: 12px;"></div>
                  <span style="display: inline-block; vertical-align: middle; font-size: 20px; font-weight: 700; color: #2e3277;">Aura Social</span>
                </div>


                <!-- Main Content -->
                <div style="padding: 48px 32px; text-align: center;">
                     <div style="margin-bottom: 24px;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background-color: #f5f3ff; border-radius: 16px;">
                      <img src="https://img.icons8.com/ios-filled/100/6f63dd/lock.png" width="32" height="32" alt="Lock" />
                    </div>
                  </div>

                  <h1 style="font-size: 32px; font-weight: 800; color: #1e1b4b; margin: 0 0 16px 0;">Verifique seu e-mail</h1>
                  
                  <p style="font-size: 16px; color: #6b7280; line-height: 24px; margin: 0 0 32px 0;">
                    Olá! Use o código de verificação abaixo para<br>confirmar seu endereço de e-mail e concluir seu cadastro.
                  </p>

                  <!-- OTP Box -->
                  <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <span style="font-size: 48px; font-weight: 800; color: #6f63dd; letter-spacing: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${code}</span>
                  </div>

                  <!-- Expiration Badge -->
                  <div style="display: inline-block; background-color: #f9fafb; border-radius: 8px; padding: 8px 16px; margin-bottom: 48px; vertical-align: middle;">
                    <img src="https://img.icons8.com/ios-filled/50/6f63dd/clock--v1.png" width="16" height="16" style="vertical-align: middle; margin-right: 8px;" />
                    <span style="font-size: 14px; color: #6f63dd; font-weight: 500; vertical-align: middle;">Este código expira em <span style="font-weight: 700;">5 minutos.</span></span>
                  </div>

                  <div style="border-top: 1px solid #f3f4f6; margin: 0 0 32px 0;"></div>

                  <p style="font-size: 14px; color: #9ca3af; line-height: 20px; margin: 0 0 24px 0;">
                    Se você não solicitou este código, ignore este e-mail.<br>Sua conta continua protegida.
                  </p>

                  <div style="font-size: 16px; color: #1e1b4b; font-weight: 700;">
                    <span style="color: #6f63dd;">💜</span> Equipe Aura Social
                  </div>
                  <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Conectando pessoas, criando conexões.</p>

                </div>

                <!-- Footer / Social -->
                <div style="padding: 32px; background-color: #ffffff; border-top: 1px solid #f3f4f6; text-align: center;">
                  <div style="margin-bottom: 24px;">
                    <a href="#" style="display: inline-block; margin: 0 12px;">
                      <img src="https://img.icons8.com/ios-filled/50/6f63dd/instagram-new.png" width="24" height="24" alt="Instagram" />
                    </a>
                    <a href="#" style="display: inline-block; margin: 0 12px;">
                      <img src="https://img.icons8.com/ios-filled/50/6f63dd/twitter.png" width="24" height="24" alt="Twitter" />
                    </a>
                    <a href="#" style="display: inline-block; margin: 0 12px;">
                      <img src="https://img.icons8.com/ios-filled/50/6f63dd/domain.png" width="24" height="24" alt="Website" />
                    </a>
                  </div>

                  <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} Aura Social Inc. Todos os direitos reservados.</p>
                  <div style="font-size: 12px; color: #6f63dd; font-weight: 500;">
                    <a href="#" style="color: #6f63dd; text-decoration: none;">Política de Privacidade</a>
                    <span style="color: #cbd5e1; margin: 0 8px;">&bull;</span>
                    <a href="#" style="color: #6f63dd; text-decoration: none;">Termos de Uso</a>
                    <span style="color: #cbd5e1; margin: 0 8px;">&bull;</span>
                    <a href="#" style="color: #6f63dd; text-decoration: none;">Suporte</a>
                  </div>
                </div>

              </div>
            </div>
          `,




        }),
      });

      if (!resendResponse.ok) {
        const errData = await resendResponse.json().catch(() => ({}));
        console.error('Falha ao enviar e-mail pela Resend:', errData);
        throw new Error(`Erro do Resend: ${errData.message || JSON.stringify(errData)}`);
      }
    } catch (emailError: any) {
      console.error('Erro ao enviar e-mail:', emailError);
      throw new Error(emailError.message || 'Erro ao processar disparo de e-mail.');
    }





    return NextResponse.json({ success: true, message: 'Código gerado e enviado com sucesso.' });
  } catch (error: any) {
    console.error('Erro no envio do OTP:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
