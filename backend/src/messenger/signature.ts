import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signature HMAC-SHA256 du corps brut, au format de l'en-tête X-Hub-Signature-256. */
export function signPayload(rawBody: Buffer | string, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

/**
 * Vérifie que le webhook vient bien de Meta : HMAC du corps brut (octets reçus, non re-sérialisés)
 * avec le secret de l'application, comparé en temps constant.
 */
export function isValidSignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (header === undefined || !header.startsWith('sha256=')) {
    return false;
  }
  const expected = Buffer.from(signPayload(rawBody, appSecret));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
