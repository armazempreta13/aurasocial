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
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; padding: 40px 10px; color: #111827;">
              <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.04); border: 1px solid #e5e7eb;">
                
                <!-- Brand Header -->
                <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
                  <div style="display: inline-block; padding: 12px; background: rgba(255, 255, 255, 0.15); border-radius: 18px; margin-bottom: 12px;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
                      <path d="M2 17L12 22L22 17"></path>
                      <path d="M2 12L12 17L22 12"></path>
                    </svg>
                  </div>
                  <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Aura Social</div>
                </div>

                <!-- Content Area -->
                <div style="padding: 56px 48px; text-align: center;">
                  
                  <div style="margin-bottom: 40px;">
                    <h1 style="font-size: 32px; font-weight: 800; color: #1e1b4b; margin: 0 0 12px 0; letter-spacing: -1px;">Código de Verificação</h1>
                    <p style="font-size: 18px; color: #4b5563; line-height: 28px; margin: 0;">
                      Estamos felizes em ter você conosco! Para continuar com sua segurança,<br>use o código abaixo para validar seu e-mail.
                    </p>
                  </div>

                  <!-- Professional OTP Grid -->
                  <div style="margin-bottom: 40px;">
                    <table align="center" border="0" cellpadding="0" cellspacing="8" style="margin: 0 auto;">
                      <tr>
                        ${code.split('').map(digit => `
                          <td style="width: 58px; height: 68px; background: #f3f4f6; border: 2px solid #e5e7eb; border-radius: 14px; font-size: 32px; font-weight: 800; color: #7c3aed; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                            ${digit}
                          </td>
                        `).join('')}
                      </tr>
                    </table>
                  </div>

                  <!-- Expiration Status -->
                  <div style="display: inline-block; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 50px; padding: 10px 24px; margin-bottom: 48px;">
                    <table border="0" cellpadding="0" cellspacing="0" style="display: inline-block;">
                      <tr>
                        <td style="padding-right: 8px; vertical-align: middle;">
                          <img src="https://img.icons8.com/ios-filled/50/7c3aed/alarm-clock.png" width="18" height="18" alt="clock" style="display: block;" />
                        </td>
                        <td style="font-size: 14px; color: #7c3aed; font-weight: 600; vertical-align: middle;">
                          Expira em 5 minutos
                        </td>
                      </tr>
                    </table>
                  </div>

                  <div style="height: 1px; background: #f3f4f6; margin-bottom: 40px;"></div>

                  <div style="font-size: 15px; color: #6b7280; line-height: 24px; margin-bottom: 48px;">
                    Se você não iniciou esta ação na Aura Social, ignore este e-mail.<br>
                    Ninguém além de você pode ver este código.
                  </div>

                  <div style="background: #fafafa; border-radius: 16px; padding: 24px;">
                    <div style="font-size: 16px; color: #1e1b4b; font-weight: 700; margin-bottom: 4px;">💜 Equipe Aura Social</div>
                    <div style="font-size: 14px; color: #9ca3af;">A plataforma onde a autenticidade brilha.</div>
                  </div>

                </div>

                <!-- Footer with Socials -->
                <div style="background: #1e1b4b; padding: 48px; text-align: center;">
                  <div style="margin-bottom: 24px;">
                    <a href="https://instagram.com/aurasocial" style="display: inline-block; margin: 0 10px; text-decoration: none;">
                      <img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" width="22" height="22" alt="Instagram" />
                    </a>
                    <a href="https://twitter.com/aurasocial" style="display: inline-block; margin: 0 10px; text-decoration: none;">
                      <img src="https://img.icons8.com/ios-filled/50/ffffff/twitter.png" width="22" height="22" alt="Twitter" />
                    </a>
                    <a href="https://aurasocial.top" style="display: inline-block; margin: 0 10px; text-decoration: none;">
                      <img src="https://img.icons8.com/ios-filled/50/ffffff/domain.png" width="22" height="22" alt="Web" />
                    </a>
                  </div>
                  
                  <p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px 0;">&copy; ${new Date().getFullYear()} Aura Social Inc. Todos os direitos reservados.</p>
                  
                  <div style="font-size: 13px; color: #6366f1; font-weight: 500;">
                    <a href="#" style="color: #818cf8; text-decoration: none;">Privacidade</a>
                    <span style="color: #475569; margin: 0 10px;">|</span>
                    <a href="#" style="color: #818cf8; text-decoration: none;">Termos</a>
                    <span style="color: #475569; margin: 0 10px;">|</span>
                    <a href="#" style="color: #818cf8; text-decoration: none;">Suporte</a>
                  </div>
                </div>

              </div>
              
              <div style="text-align: center; padding-top: 24px;">
                <p style="font-size: 11px; color: #9ca3af; margin: 0;">Recebido por ${email}.</p>
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
