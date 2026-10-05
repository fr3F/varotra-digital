/**
 * Simule un client qui écrit à la Page Facebook : envoie au backend local un webhook signé
 * exactement comme Meta, puis affiche les réponses du bot (routes /dev, DEV_TOOLS=true).
 *
 *   npm run simulate -- "2 huile tiko et 1 savon"      message texte
 *   npm run simulate -- --reply CHECKOUT                bouton de réponse rapide
 *   npm run simulate -- --postback GET_STARTED          bouton « Démarrer »
 *   npm run simulate -- --psid 555 "menu"              autre client (défaut : 1000001)
 */
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { signPayload } from '../src/messenger/signature.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    psid: { type: 'string', default: '1000001' },
    reply: { type: 'string' },
    postback: { type: 'string' },
    url: { type: 'string', default: `http://localhost:${process.env['PORT'] ?? '3000'}` },
  },
});

const secret = process.env['META_APP_SECRET'];
if (secret === undefined || secret.length === 0) {
  console.error('META_APP_SECRET manquant (fichier backend/.env).');
  process.exit(1);
}

const text = positionals.join(' ');
const psid = values.psid;
const timestamp = Date.now();
const messaging =
  values.postback !== undefined
    ? { sender: { id: psid }, recipient: { id: 'PAGE' }, timestamp, postback: { title: values.postback, payload: values.postback } }
    : {
        sender: { id: psid },
        recipient: { id: 'PAGE' },
        timestamp,
        message: {
          mid: `m_${randomUUID()}`,
          text: text.length > 0 ? text : (values.reply ?? ''),
          ...(values.reply === undefined ? {} : { quick_reply: { payload: values.reply } }),
        },
      };

if (values.postback === undefined && values.reply === undefined && text.length === 0) {
  console.error('Indiquez un message, --reply PAYLOAD ou --postback PAYLOAD.');
  process.exit(1);
}

const body = JSON.stringify({ object: 'page', entry: [{ id: 'PAGE', time: timestamp, messaging: [messaging] }] });

async function lastOutgoingId(): Promise<number> {
  const response = await fetch(`${values.url}/dev/outgoing?psid=${psid}&after=0`);
  if (!response.ok) {
    throw new Error('Routes /dev indisponibles : lancez le backend avec DEV_TOOLS=true.');
  }
  const data = (await response.json()) as { lastId: number };
  return data.lastId;
}

const before = await lastOutgoingId();
console.log(`\n👤 Client ${psid} : ${values.postback ?? (text || `[bouton ${values.reply}]`)}`);

const response = await fetch(`${values.url}/webhooks/messenger`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signPayload(body, secret) },
  body,
});
if (!response.ok) {
  console.error(`Webhook refusé : ${response.status} ${await response.text()}`);
  process.exit(1);
}

// Le backend répond 200 tout de suite puis traite le message : on attend ses réponses.
await new Promise((resolve) => setTimeout(resolve, 600));
const replies = (await (await fetch(`${values.url}/dev/outgoing?psid=${psid}&after=${before}`)).json()) as {
  messages: { text: string; quickReplies: string[]; status: string }[];
};
for (const message of replies.messages) {
  console.log(`\n🤖 Page (${message.status}) :\n${message.text}`);
  if (message.quickReplies.length > 0) {
    console.log(`   Boutons : ${message.quickReplies.join(' | ')}`);
  }
}
