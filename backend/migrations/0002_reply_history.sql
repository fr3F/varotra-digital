-- Historique des réponses par commande et statut de la commande vu par le client.

ALTER TABLE outgoing_messages ADD COLUMN draft_id TEXT;
ALTER TABLE outgoing_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'CONVERSATION';
CREATE INDEX idx_outgoing_draft ON outgoing_messages (draft_id, id);
ALTER TABLE order_drafts ADD COLUMN customer_status TEXT NOT NULL DEFAULT 'RECEIVED';
ALTER TABLE order_drafts ADD COLUMN customer_status_at TEXT;
CREATE INDEX idx_order_drafts_psid ON order_drafts (psid, created_at);
