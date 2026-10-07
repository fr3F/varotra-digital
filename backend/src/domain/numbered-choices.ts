import { type Lang, MESSAGES } from './i18n.ts';
import type { OutgoingReply, QuickReply } from './types.ts';

/**
 * Facebook Lite (téléphone) n'affiche pas les bulles à boutons : les choix sont aussi écrits dans le
 * texte, numérotés, et le client peut répondre « 1 », « 2 »… Pas de numéros quand un bouton est
 * déjà un nombre (choix de quantité) : le client tape directement la quantité.
 */
export function numberedChoices(quickReplies: readonly QuickReply[] | undefined): readonly QuickReply[] {
  const choices = quickReplies ?? [];
  return choices.some((choice) => /^\d+$/.test(choice.title.trim())) ? [] : choices;
}

/** Choix numérotés de la dernière réponse qui en a : le prochain « 1 », « 2 »… y renvoie. */
export function choicesOf(replies: readonly OutgoingReply[]): readonly QuickReply[] {
  return numberedChoices(replies.findLast((reply) => (reply.quickReplies ?? []).length > 0)?.quickReplies);
}

/** Texte de la réponse suivi de la liste numérotée de ses choix et d'une consigne. */
export function withNumberedChoices(reply: OutgoingReply, lang: Lang): OutgoingReply {
  const choices = numberedChoices(reply.quickReplies);
  if (choices.length === 0) {
    return reply;
  }
  const list = choices.map((choice, index) => `${index + 1}. ${choice.title}`).join('\n');
  return { ...reply, text: `${reply.text}\n\n${list}\n${MESSAGES[lang].chooseByNumber}` };
}

/** Charge utile du choix tapé par son numéro (« 2 », « 2. »), ou null. */
export function choiceFromText(text: string, choices: readonly QuickReply[]): string | null {
  const match = /^\s*(\d{1,2})\s*[.)]?\s*$/.exec(text);
  if (match === null) {
    return null;
  }
  return choices[Number(match[1]) - 1]?.payload ?? null;
}
