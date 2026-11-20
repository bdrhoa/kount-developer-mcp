import { z } from 'zod';
import { paymentPolicy } from '../resources/v2/payment-policy.js';
const fields = [
  'payment_identifier',
  'authorization',
  'avs',
  'cvv',
  'shipping_method',
  'buyer',
  'billing_address',
  'shipping_address',
  'line_items',
  'amounts_currency',
  'device_context',
] as const;
export const mappingCoverage = z.strictObject({
  fields: z
    .array(
      z.strictObject({
        field: z.enum(fields),
        availability: z.enum(['available', 'unavailable', 'not_applicable', 'unknown']),
        mapped: z.boolean().optional(),
        semanticsVerified: z.boolean().optional(),
      }),
    )
    .max(fields.length)
    .refine(
      (entries) => new Set(entries.map((e) => e.field)).size === entries.length,
      'Do not repeat field names.',
    )
    .optional(),
  payment: z
    .strictObject({
      fullPanAvailable: z.boolean().optional(),
      binAvailable: z.boolean().optional(),
      last4Available: z.boolean().optional(),
      tokenPersistence: z
        .enum(['persistent', 'nonpersistent', 'unavailable', 'unknown'])
        .optional(),
      panKhashedLocally: z.boolean().optional(),
      submitted: z
        .strictObject({
          type: z.enum(['CREDIT_CARD', 'TOKEN', 'NONE']),
          paymentTokenKind: z.enum(['khash', 'persistent', 'nonpersistent', 'unknown', 'absent']),
          binPresent: z.boolean().optional(),
          last4Present: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});
const check = (v: boolean | undefined) =>
  v === undefined ? 'unverified' : v ? 'verified' : 'failed';
export function assessMappingCoverage(input: z.infer<typeof mappingCoverage>) {
  const p = input.payment;
  const expected =
    p?.fullPanAvailable === true
      ? { type: 'CREDIT_CARD', token: 'khash' }
      : p?.fullPanAvailable !== false
        ? undefined
        : p.tokenPersistence === 'persistent'
          ? { type: 'TOKEN', token: 'persistent' }
          : p.tokenPersistence === undefined || p.tokenPersistence === 'unknown'
            ? undefined
            : p.binAvailable === true || p.last4Available === true
              ? { type: 'CREDIT_CARD', token: 'absent' }
              : p.binAvailable === false && p.last4Available === false
                ? { type: 'NONE', token: 'absent' }
                : undefined;
  const submitted = p?.submitted;
  const partial = (available: boolean | undefined, present: boolean | undefined) =>
    check(available === undefined || present === undefined ? undefined : available === present);
  return {
    evidence: 'caller_reported_only',
    schemaValidity: 'assessed_separately',
    paymentPolicy,
    payment: {
      expectedType: expected?.type ?? null,
      expectedPaymentTokenKind: expected?.token ?? null,
      checks: {
        mapping: check(
          expected && submitted
            ? submitted.type === expected.type && submitted.paymentTokenKind === expected.token
            : undefined,
        ),
        khash: p?.fullPanAvailable === true ? check(p.panKhashedLocally) : 'not_applicable',
        usefulToken: check(
          submitted
            ? submitted.paymentTokenKind === 'nonpersistent'
              ? false
              : submitted.paymentTokenKind === 'unknown'
                ? undefined
                : true
            : undefined,
        ),
        bin: partial(p?.binAvailable, submitted?.binPresent),
        last4: partial(p?.last4Available, submitted?.last4Present),
      },
    },
    fields: fields.map((field) => {
      const e = input.fields?.find((entry) => entry.field === field);
      const status =
        !e || e.availability === 'unknown'
          ? 'unverified'
          : e.availability === 'not_applicable'
            ? e.mapped === true
              ? 'unexpected_mapping'
              : 'not_applicable'
            : e.availability === 'unavailable'
              ? e.mapped === true
                ? 'unsupported_mapping'
                : 'unavailable'
              : e.mapped === false
                ? 'available_but_omitted'
                : e.mapped !== true || e.semanticsVerified !== true
                  ? 'unverified'
                  : 'mapped';
      return { field, status };
    }),
    limitation:
      'Availability and mapping declarations do not verify KHASH, token stability or live acceptance. Supply booleans/enums only, never PAN, BIN, last4 or token values. Optional-data gaps are advisory and do not change vendor schema validity.',
  };
}
