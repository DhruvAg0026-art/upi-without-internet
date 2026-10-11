export function parseAmountToPaise(value) {
  const amount = String(value ?? '').trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error('Amount must be a positive number with at most two decimal places.');

  const paise = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (paise <= 0n || paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount is outside the supported range.');
  }
  return Number(paise);
}

export function paiseToRupees(paise) {
  return paise / 100;
}