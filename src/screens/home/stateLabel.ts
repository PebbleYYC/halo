// The Stress card's spoken label. "Today" only on today, and no empty minutes part before the first minutes arrive.
export function stateCardLabel(title: string, spoken: string, today: boolean): string {
  const minutes = spoken ? (today ? ` Today: ${spoken}.` : ` ${spoken}.`) : "";
  return `${title}.${minutes} Opens Stress.`;
}
