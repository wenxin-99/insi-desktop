/**
 * paymentConfig/types — 共享类型
 */

export interface PaymentConfigData {
  stripePublicKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  alipayAppId?: string;
  alipayPrivateKey?: string;
  alipayPublicKey?: string;
  alipayNotifyUrl?: string;
  alipayReturnUrl?: string;
  wechatAppId?: string;
  wechatMchId?: string;
  wechatApiKey?: string;
  wechatNotifyUrl?: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export type Provider = "stripe" | "alipay" | "wechat";

export interface ProviderConfig {
  enabled: boolean;
  config: Partial<PaymentConfigData>;
  notes: string;
}
