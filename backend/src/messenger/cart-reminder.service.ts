import type { Repositories } from '../db/repositories.ts';
import { cartReminder } from '../domain/conversation-engine.ts';
import { choicesOf, withNumberedChoices } from '../domain/numbered-choices.ts';
import type { FacebookNotificationService } from './facebook-notification.service.ts';
import { POPULAR_COUNT, popularitySince } from './messenger-service.ts';

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/** Relance après 1 h de silence, tant que la fenêtre Messenger de 24 h est encore ouverte. */
const REMIND_AFTER_MS = 60 * 60 * 1000;
const REMIND_BEFORE_MS = 23 * 60 * 60 * 1000;

/**
 * Relance unique des paniers abandonnés : le client a rempli un panier sans le valider.
 * Un seul rappel par panier (il faut un nouveau message du client pour en déclencher un autre).
 */
export function createCartReminderService(deps: {
  readonly repos: Repositories;
  readonly notifications: FacebookNotificationService;
  readonly logger: Logger;
  readonly now?: () => Date;
}) {
  const { repos, notifications, logger } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    /** Renvoie le nombre de clients relancés. */
    async remindAbandonedCarts(): Promise<number> {
      const current = now();
      const candidates = await repos.conversations.findReminderCandidates(
        new Date(current.getTime() - REMIND_BEFORE_MS).toISOString(),
        new Date(current.getTime() - REMIND_AFTER_MS).toISOString(),
      );
      if (candidates.length === 0) {
        return 0;
      }
      const catalog = await repos.catalog.findAll();
      const popularIds = await repos.drafts.popularProductIds(popularitySince(current), POPULAR_COUNT);
      let reminded = 0;
      for (const conversation of candidates) {
        const reply = cartReminder(conversation.state, { catalog, customerName: conversation.customerName, popularIds });
        if (reply !== null) {
          // Les boutons de la relance deviennent les choix numérotés de la conversation.
          await repos.conversations.save({ ...conversation, state: { ...conversation.state, choices: choicesOf([reply]) } });
          if (await notifications.send(conversation.psid, withNumberedChoices(reply, conversation.state.lang))) {
            reminded += 1;
          }
        }
        // Marqué même sans envoi (panier vide, échec Meta) : jamais de relances en boucle.
        await repos.conversations.markReminded(conversation.psid, current.toISOString());
      }
      if (reminded > 0) {
        logger.info(`Paniers abandonnés : ${reminded} client(s) relancé(s).`);
      }
      return reminded;
    },
  };
}
