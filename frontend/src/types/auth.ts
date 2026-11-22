export interface AuthStatusResponse {
  authMode?: 'account_otp' | 'api_key';
  sessionTransport?: 'http_only_cookies';
  hasSessionCookie?: boolean;
  resendConfigured?: boolean;
  registrationEnabled?: boolean;
  hasEnvApiKey: boolean;
  needsBootstrapKey: boolean;
}

export interface SessionPrincipal {
  method: 'user_session' | 'api_key';
  userId?: number;
  sessionId?: number;
  username?: string;
  email?: string;
  isEmailVerified?: boolean;
  displayName?: string;
  keyName?: string;
}

export interface OtpChallengeResponse {
  challengeToken: string;
  purpose: 'email_verification' | 'login_otp';
  maskedEmail: string;
  username: string;
  expiresAt: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  emailDeliveryId?: string | null;
  message: string;
}

export interface VerifyOtpResponse {
  authenticated: boolean;
  expiresAt: string;
  principal: SessionPrincipal;
}

export interface RefreshSessionResponse {
  refreshed: boolean;
  expiresAt: string;
  principal: SessionPrincipal;
}

export interface ForgotPasswordResponse {
  sent: boolean;
  message: string;
}

export interface ValidateResetTokenResponse {
  valid: boolean;
  username: string;
  maskedEmail: string;
  expiresAt: string;
}

export interface ResetPasswordResponse {
  reset: boolean;
  username: string;
  revokedSessions: number;
  message: string;
}
