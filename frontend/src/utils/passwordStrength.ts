export interface PasswordEvaluation {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Empty' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  hasMinLength: boolean;
  hasMixedCase: boolean;
  hasDigit: boolean;
  hasSymbolOrLong: boolean;
  isValid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordEvaluation {
  const hasMinLength = password.length >= 8;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasMixedCase = hasLower && hasUpper;
  const hasDigit = /\d/.test(password);
  const hasSymbolOrLong = password.length >= 12 || /[^A-Za-z0-9]/.test(password);

  if (!password) {
    return {
      score: 0,
      label: 'Empty',
      hasMinLength: false,
      hasMixedCase: false,
      hasDigit: false,
      hasSymbolOrLong: false,
      isValid: false,
    };
  }

  let points = 0;
  if (hasMinLength) points += 1;
  if (hasMixedCase) points += 1;
  if (hasDigit) points += 1;
  if (hasSymbolOrLong && hasMinLength) points += 1;

  const score = Math.min(4, Math.max(1, points)) as 1 | 2 | 3 | 4;
  const label =
    score === 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Strong' : 'Very strong';

  return {
    score,
    label,
    hasMinLength,
    hasMixedCase,
    hasDigit,
    hasSymbolOrLong,
    isValid: hasMinLength && hasMixedCase && hasDigit,
  };
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{3,32}$/.test(username.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
