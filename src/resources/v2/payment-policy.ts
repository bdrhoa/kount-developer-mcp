/** User-confirmed client mapping policy (D012); no PAN processing inside MCP. */
export const paymentPolicy = {
  authority: 'maintainer_requested',
  priority: [
    'If full PAN is available, KHASH it locally using the verified Kount KHASH procedure, send the KHASH as paymentToken, and set payment.type=CREDIT_CARD. Never substitute plain SHA-256 or send PAN to this MCP.',
    'Otherwise, if a persistent provider token identifies the same card across transactions (for example the scoped Stripe identifier chosen by the merchant), send it as paymentToken with payment.type=TOKEN. Verify persistence and account/environment scope; do not assume every Stripe token or PaymentMethod ID is persistent.',
    'Otherwise, if BIN and/or last4 are available, include them and set payment.type=CREDIT_CARD without inventing a paymentToken.',
    'Otherwise omit paymentToken and set payment.type=NONE. Nonpersistent values that change for the same card are not useful card identifiers; never send them as paymentToken.',
  ],
  partialData:
    'Include available BIN and last4; omit unavailable values. Do not infer BIN from last4, test cards or dashboards. A persistent-token mapping remains TOKEN even when partial card data is also available.',
  khash:
    'KHASH must follow verified Kount instructions/library and be performed locally in the consuming application. This MCP does not accept PAN, implement an unverified KHASH algorithm, or establish live provider acceptance. Preserve published-schema conflicts separately from this maintainer policy.',
};
