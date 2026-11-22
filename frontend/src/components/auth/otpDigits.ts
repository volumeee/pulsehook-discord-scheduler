export const OTP_LENGTH = 6;

export function updateOtpDigits(digits: string[], index: number, value: string): string[] {
  const next = [...digits];
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) {
    next[index] = '';
    return next;
  }
  for (let offset = 0; offset < cleaned.length && index + offset < OTP_LENGTH; offset += 1) {
    next[index + offset] = cleaned[offset];
  }
  return next;
}

export function pastedOtpDigits(value: string): string[] {
  const cleaned = value.replace(/\D/g, '');
  return Array.from({ length: OTP_LENGTH }, (_, index) => cleaned[index] || '');
}
