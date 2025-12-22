export type PaymentRequirements = {
  scheme: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
};

export type VerifyReq = {
  paymentRequirements: PaymentRequirements;
  paymentPayload?: unknown;
};

export type SettleReq = {
  paymentRequirements: PaymentRequirements;
  paymentPayload: unknown;
};

export type VerifyResNormalized = {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  rawProvider?: unknown;
};

export type SettleResNormalized = {
  success: boolean;
  payer?: string;
  txHash?: string;
  network?: string;
  errorReason?: string;
  rawProvider?: unknown;
};
