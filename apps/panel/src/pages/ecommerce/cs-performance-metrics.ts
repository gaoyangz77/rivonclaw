export type DailyMoneyPoint = {
  dateKey: string;
  value: number | null;
  currency: string | null | undefined;
};

export function completeSevenDayAverage(points: DailyMoneyPoint[]): number | null {
  if (points.length !== 7) return null;

  const currency = points[0].currency;
  if (!currency) return null;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (point.value == null || point.currency !== currency) return null;
    if (index === 0) continue;

    const previousDate = Date.parse(`${points[index - 1].dateKey}T00:00:00Z`);
    const currentDate = Date.parse(`${point.dateKey}T00:00:00Z`);
    if (!Number.isFinite(previousDate) || !Number.isFinite(currentDate)) return null;
    if (currentDate - previousDate !== 86_400_000) return null;
  }

  return points.reduce((sum, point) => sum + (point.value ?? 0), 0) / 7;
}
