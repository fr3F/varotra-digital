/**
 * Thème « Bite » : rouge bordeaux (marque), blanc, accent jaune ; boutons et barre d'onglets en pilule.
 */
export const colors = {
  primary: '#A3161D',
  primaryDark: '#7D0F14',
  primaryLight: '#FBE9EA',
  /** Accent jaune (bandeaux, promotions). */
  accent: '#FFB01F',
  accentLight: '#FFF4DE',
  /** Fond blanc comme le modèle : cartes détachées par leur ombre, champs en gris clair. */
  background: '#FFFFFF',
  surface: '#FFFFFF',
  /** Champs de saisie et puces non sélectionnées (gris clair du modèle). */
  field: '#F1F1F3',
  text: '#1C1C1E',
  /** Texte secondaire : contraste ≥ 4.5:1 sur blanc et sur le fond gris (lisible en plein soleil). */
  textMuted: '#5C5C63',
  border: '#ECECEE',
  danger: '#C2410C',
  dangerLight: '#FFEDD5',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  success: '#15803D',
  successLight: '#DCFCE7',
  info: '#1D4ED8',
  infoLight: '#DBEAFE',
  onPrimary: '#FFFFFF',
  /** Marques des graphiques (teinte de la marque). */
  chart: '#A3161D',
  chartAxis: '#D1D5DB',
} as const;

/** Ombre douce des cartes (iOS : shadow*, Android : elevation). */
export const shadow = {
  shadowColor: '#000000',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Échelle typographique (corps 16 : lecture confortable sur téléphone). */
export const fontSize = {
  sm: 14,
  md: 16,
  lg: 19,
  xl: 24,
  xxl: 30,
} as const;
