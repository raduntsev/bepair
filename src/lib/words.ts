/*
  Russian past tense agrees with gender: «Аня отметила», «Алекс отметил».
  Gender is optional in the profile; without it the verb takes the neutral
  written form «отметил(а)» rather than guessing.
*/
export type Gender = 'm' | 'f' | null | undefined;

export function verb(gender: Gender, masculine: string) {
  if (gender === 'm') return masculine;
  if (masculine.endsWith('ся')) {
    const stem = masculine.slice(0, -2);
    return gender === 'f' ? `${stem}ась` : `${stem}(а)сь`;
  }
  return gender === 'f' ? `${masculine}а` : `${masculine}(а)`;
}

export function displayName(name: string | null | undefined, fallback = 'Партнёр') {
  const trimmed = name?.trim();
  return trimmed ? trimmed : fallback;
}

/*
  Genitive for «от Ани», «у Алекса». A light rule set that covers common
  Russian names; anything it does not recognise (foreign names, female names
  ending in a consonant) is returned unchanged, which reads as indeclinable
  rather than wrong.
*/
export function genitive(name: string, gender: Gender) {
  const word = name.trim();
  if (!word || !/^[А-ЯЁа-яё-]+$/.test(word)) return word;
  const lower = word.toLowerCase();
  const last = lower.slice(-1);
  const prev = lower.slice(-2, -1);
  const stem = word.slice(0, -1);

  if (last === 'а') return stem + ('гкхжшчщ'.includes(prev) ? 'и' : 'ы');
  if (last === 'я') return lower.endsWith('ия') ? `${stem}и` : `${stem}и`;
  if (gender === 'f') return word;
  if (last === 'й' || last === 'ь') return `${stem}я`;
  if ('бвгджзклмнпрстфхцчшщ'.includes(last)) return `${word}а`;
  return word;
}
