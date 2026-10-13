/** Shared, backward-compatible multi-choice clinical indicators. Never modify resident identity. */
export const EMOTION_OPTIONS = [
  { value: 'HAPPY_SOCIABLE', label: 'Vui vẻ, hòa đồng' },
  { value: 'WITHDRAWN', label: 'Thu mình, ít nói' },
  { value: 'IRRITABLE', label: 'Hay cáu gắt, kích động' },
  { value: 'ANXIOUS_DEPRESSED', label: 'Lo âu' },
] as const;
export const SLEEP_OPTIONS = [
  { value: 'GOOD', label: 'Ngủ tốt' },
  { value: 'INSOMNIA', label: 'Khó ngủ / Mất ngủ' },
  { value: 'NIGHT_WAKING', label: 'Thường thức giấc ban đêm' },
] as const;
export type Emotion = typeof EMOTION_OPTIONS[number]['value'];
export type Sleep = typeof SLEEP_OPTIONS[number]['value'];
export function normalizeChoices<T extends string>(values: unknown, legacy: unknown, allowed: readonly T[]): T[] {
  const source = Array.isArray(values) ? values : legacy == null ? [] : [legacy];
  return [...new Set(source.filter((value): value is T => typeof value === 'string' && allowed.includes(value as T)))];
}
export function toggleChoice<T extends string>(current: readonly T[], item: T): T[] {
  return current.includes(item) ? current.filter(v => v !== item) : [...current, item];
}
export function emotionChoices(mental: { emotionalStates?: Emotion[]; emotionalState?: Emotion }): Emotion[] {
  return normalizeChoices(mental.emotionalStates, mental.emotionalState, EMOTION_OPTIONS.map(x => x.value));
}
export function sleepChoices(mental: { sleepQualities?: Sleep[]; sleepQuality?: Sleep }): Sleep[] {
  return normalizeChoices(mental.sleepQualities, mental.sleepQuality, SLEEP_OPTIONS.map(x => x.value));
}
