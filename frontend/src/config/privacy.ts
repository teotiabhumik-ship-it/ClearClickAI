export interface PrivacyConfig {
  provider: string;
  aiEnabled: boolean;
  aiTier: 'free' | 'paid' | 'none';
}

export const privacyConfig: PrivacyConfig = {
  provider: 'Google Gemini',
  aiEnabled: true,
  aiTier: 'free',
};
