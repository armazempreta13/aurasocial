import { NextResponse } from 'next/server';
import crypto from 'crypto';
import firebaseConfig from '@/firebase-applet-config.json';

export async function POST(request: Request) {
  try {
    const { uid, code, idToken } = await request.json();

    if (!uid || !code || !idToken) {
      return NextResponse.json({ error: 'UID, Código e Token são obrigatórios.' }, { status: 400 });
    }

    // 1. Buscar o documento do usuário via Firestore REST API
    const projectId = firebaseConfig.projectId;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

    const restResponse = await fetch(firestoreUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!restResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível recuperar os dados do usuário.' }, { status: 400 });
    }

    const userData = await restResponse.json();
    const fields = userData.fields || {};

    const otpHash = fields.otpHash?.stringValue;
    const otpExpiresAt = fields.otpExpiresAt?.integerValue ? parseInt(fields.otpExpiresAt.integerValue) : 0;

    if (!otpHash || !otpExpiresAt) {
      return NextResponse.json({ error: 'Nenhum código foi gerado para este usuário.' }, { status: 400 });
    }

    // 2. Verificar Expiração
    if (Date.now() > otpExpiresAt) {
      return NextResponse.json({ error: 'O código expirou. Peça um novo código.' }, { status: 400 });
    }

    // 3. Gerar o Hash do código digitado pelo usuário
    const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

    // 4. Comparar os Hashes
    if (inputHash !== otpHash) {
      return NextResponse.json({ error: 'Código de verificação incorreto.' }, { status: 400 });
    }

    // 5. Marcar como verificado no Firestore via REST API
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=contactVerified`;

    const patchResponse = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          contactVerified: { booleanValue: true }
        }
      })
    });

    if (!patchResponse.ok) {
      return NextResponse.json({ error: 'Falha ao atualizar o status de verificação do contato.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Código verificado com sucesso.' });
  } catch (error: any) {
    console.error('Erro na validação do OTP:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
