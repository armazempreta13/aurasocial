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
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d0e15; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background: linear-gradient(145deg, #1a1c29, #131520); border: 1px solid #2c2f48; border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                
                <div style="margin-bottom: 30px;">
                  <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border-radius: 16px; box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>

                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.5px;">Verifique seu E-mail</h1>
                <p style="color: #94a3b8; font-size: 16px; line-height: 24px; margin: 0 0 30px 0;">Seja bem-vindo à Aura Social. Use o código de segurança de 6 dígitos abaixo para validar seu cadastro.</p>
                
                <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #334155; border-radius: 16px; padding: 20px; margin-bottom: 30px;">
                  <span style="font-size: 42px; font-weight: 800; color: #818cf8; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${code}</span>
                </div>

                <div style="border-top: 1px solid #2c2f48; padding-top: 20px;">
                  <p style="color: #64748b; font-size: 13px; line-height: 20px; margin: 0;">Este código expira em <strong>5 minutos</strong>.<br>Se você não solicitou este acesso, ignore este e-mail.</p>
                </div>

              </div>
              <div style="margin-top: 20px; color: #475569; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Aura Social Inc. Todos os direitos reservados.
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
