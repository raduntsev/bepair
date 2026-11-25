/*
  Who answers for the data, and which edition of the documents is in force.

  Replace each placeholder in square brackets with the value itself — without
  the brackets — before publishing. The documents read these
  values, so nothing else needs editing. When a document's meaning changes,
  raise its version: everyone is asked to agree again on their next visit.
*/
export const OPERATOR = {
  /* Фамилия, имя, отчество полностью. */
  name: 'Радунцев Алексей Евгеньевич',
  inn: '250504487207',
  /* Адрес для почтовых обращений: ч. 4 ст. 9 152-ФЗ требует адрес оператора в письменном согласии. */
  address: 'г. Дальнегорск, ул. Пионерская, д.1, кв. 75, 692441',
  /* Публичный адрес для запросов по данным. */
  email: 'alekradunc@gmail.com',
  status: 'физическое лицо, применяющее специальный налоговый режим «Налог на профессиональный доход» (самозанятый)',
};

export const APP_NAME = 'Впаре (Bepair)';
export const APP_URL = 'https://bepair.vercel.app';

/* Dates of the current editions, shown at the top of each document. */
export const PRIVACY_VERSION = '2026-11-25';
export const CONSENT_VERSION = '2026-11-25';
export const HEALTH_CONSENT_VERSION = '2026-11-25';

export const MIN_AGE = 18;

/* Until the brackets are filled, the documents say so at the top. */
export const OPERATOR_FILLED = ![OPERATOR.name, OPERATOR.inn, OPERATOR.address, OPERATOR.email].some((v) => v.startsWith('['));

export function humanDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
