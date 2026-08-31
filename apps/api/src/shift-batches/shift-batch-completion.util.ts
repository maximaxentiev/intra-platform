export function fmtTimeLabel(value: string) {
  const parts = String(value).slice(0, 5).split(':');
  const hour = Number(parts[0]);
  const minute = parts[1] ?? '00';
  if (Number.isNaN(hour)) return String(value).slice(0, 5);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function isActiveFulfilledShift(status: string) {
  return status === 'filled' || status === 'completed';
}
