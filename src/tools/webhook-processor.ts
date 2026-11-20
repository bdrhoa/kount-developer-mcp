import { z } from 'zod';
export const webhookUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
}, 'Use an HTTPS endpoint without credentials, query or fragment.');
export const webhookProcessor = z.strictObject({
  created: z.boolean().optional(),
  url: webhookUrl.optional(),
  urlExposedToUser: z.boolean().optional(),
  configurationScreenExists: z.boolean().optional(),
  urlDisplayedReadOnly: z.boolean().optional(),
});
const check = (value: boolean | undefined) =>
  value === undefined ? 'unverified' : value ? 'verified' : 'failed';
export function assessWebhookProcessor(input: z.infer<typeof webhookProcessor> = {}) {
  return {
    evidence: 'caller_reported_only',
    url: input.url ?? null,
    checks: {
      processorCreated: check(input.created),
      endpointUrl: check(input.url === undefined ? undefined : true),
      urlExposedToUser: check(input.urlExposedToUser),
      configurationDisplayOnly:
        input.configurationScreenExists === false
          ? 'not_applicable'
          : input.configurationScreenExists === true
            ? check(input.urlDisplayedReadOnly)
            : 'unverified',
    },
    instructions:
      'Always create the client webhook processor and expose its actual HTTPS URL to the user. If a configuration screen exists, show the URL as display-only. Do not require a new configuration screen. Registration and signed business-event processing need separate evidence.',
  };
}
