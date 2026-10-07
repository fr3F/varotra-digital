import { normalizeText } from '../shared/format.ts';

/** TANA : frais fixe ; OTHER : hors de la ville ou lieu inconnu, frais à convenir avec le responsable. */
export type DeliveryZone = 'TANA' | 'OTHER';

/** Coordonnées données par le client avant l'enregistrement de sa commande. */
export interface DeliveryInfo {
  readonly phone: string;
  readonly address: string;
  readonly zone: DeliveryZone;
  /** Frais annoncés au client (Ariary), ou null s'ils sont à convenir. */
  readonly fee: number | null;
}

/** Frais dans Antananarivo tant que l'application n'en a pas envoyé d'autres. */
export const DEFAULT_DELIVERY_FEE = 3000;

/**
 * Numéro malgache : 03X XX XXX XX, avec ou sans espaces, tirets, points, ou +261 / 261.
 * Renvoie le numéro écrit « 034 12 345 67 », ou null s'il n'est pas reconnu.
 */
export function normalizePhone(text: string): string | null {
  const digits = text.replace(/[\s.\-()]/g, '');
  const match = /^(?:\+?261|0)(3[2-9]\d{7})$/.exec(digits);
  if (match?.[1] === undefined) {
    return null;
  }
  const local = `0${match[1]}`;
  return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 8)} ${local.slice(8)}`;
}

/**
 * Communes autour de la capitale : livraison possible mais frais à convenir (avant la ville,
 * car « Ambohimangakely » ou « Antananarivo Avaradrano » contiennent aussi des mots de la ville).
 */
const OUTSIDE_TANA = [
  'ivato', 'talatamaty', 'ambohidratrimo', 'itaosy', 'ampitatafika', 'anosizato', 'fenoarivo', 'ampahitrosy',
  'andoharanofotsy', 'tanjombato', 'ambohimangakely', 'ankadikely', 'ilafy', 'sabotsy namehana', 'alasora',
  'ambohijanaka', 'bongatsara', 'ampandrianomby', 'ambatomirahavavy', 'ambohimalaza', 'avaradrano', 'atsimondrano',
  'iavoloha', 'ambohitrimanjaka', 'antehiroka', 'imerintsiatosika', 'arivonimamo', 'antsirabe', 'toamasina',
  'tamatave', 'taolagnaro', 'fort dauphin', 'mahajanga', 'majunga', 'fianarantsoa', 'toliara', 'tulear',
  'antsiranana', 'diego', 'moramanga',
];

/** Ville d'Antananarivo (6 arrondissements) : nom de la ville et quartiers courants. */
const TANA = [
  'antananarivo', 'tananarive', 'tana', 'renivohitra', 'arrondissement', 'boriboritany',
  'analakely', 'antaninarenina', 'tsaralalana', 'isoraka', 'ambohijatovo', 'andravoahangy', 'besarety', 'behoririka',
  'ankorondrano', 'andraharo', 'ankorahotra', 'ambondrona', 'mahamasina', 'anosy', 'ampefiloha', 'isotry',
  'andohalo', 'faravohitra', 'ambanidia', 'ambohipo', 'ankatso', 'ankadifotsy', 'antanimena', 'ambatonakanga',
  'ampasampito', 'ankadindramamy', 'ivandry', 'ambatobe', 'alarobia', 'andranomena', 'mahazo', 'ambohimiandra',
  'andavamamba', 'anjanahary', 'ampasanimalo', 'ambolokandrina', 'ankazomanga', 'andrefan ambohijanahary',
  'ambohimanarina', 'antanimora', 'ankaditapaka', 'tsimbazaza', 'ambatoroka', 'ampandrana', 'antsakaviro',
  'manjakaray', 'nanisana', 'ambohitsoa', 'mandroseza', 'ambodivona', 'soarano', '67ha', '67 ha', 'ambodin isotry',
  'ankadimbahoaka', 'anosibe', 'anatihazo', 'ampasika', 'antsahabe', 'ambohidahy',
  'avaradoha', 'ambohimahitsy', 'analamahitsy', 'ambatomainty', 'andrononobe', 'amboditsiry', 'antsobolo',
];

function containsPlace(normalized: string, places: readonly string[]): boolean {
  const padded = ` ${normalized} `;
  return places.some((place) => padded.includes(` ${normalizeText(place)} `));
}

/** Zone de livraison lue dans l'adresse : en cas de doute, frais à convenir (jamais un faux tarif). */
export function deliveryZone(address: string): DeliveryZone {
  const normalized = normalizeText(address);
  if (containsPlace(normalized, OUTSIDE_TANA)) {
    return 'OTHER';
  }
  return containsPlace(normalized, TANA) ? 'TANA' : 'OTHER';
}
