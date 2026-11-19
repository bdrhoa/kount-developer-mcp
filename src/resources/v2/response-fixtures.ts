export const responseFixtures = {
  scope: 'Synthetic parser acceptance fixtures, not live API acceptance evidence.',
  fixtures: [
    {
      name: 'object_review',
      provenance: 'pinned_schema_shape',
      mode: 'evaluation',
      body: {
        order: {
          orderId: 'synthetic-order',
          riskInquiry: { decision: 'REVIEW', device: { id: 'synthetic-device' } },
          transactions: [{ transactionId: 'synthetic-transaction' }],
        },
      },
      expected: 'usable_decision',
    },
    {
      name: 'array_approve',
      provenance: 'reference_example_shape_conflicting_with_schema',
      mode: 'evaluation',
      body: { order: { orderId: 'synthetic-order', riskInquiry: [{ decision: 'APPROVE' }] } },
      expected: 'usable_decision_with_shape_conflict',
    },
    {
      name: 'unknown_decision',
      provenance: 'synthetic_negative_case',
      mode: 'evaluation',
      body: { order: { orderId: 'synthetic-order', riskInquiry: { decision: 'DECLINED' } } },
      expected: 'unknown_decision',
    },
    {
      name: 'missing_decision',
      provenance: 'synthetic_negative_case',
      mode: 'evaluation',
      body: { order: { orderId: 'synthetic-order' } },
      expected: 'missing_decision',
    },
    {
      name: 'data_only_ack',
      provenance: 'synthetic_operation_intent_case',
      mode: 'data_only',
      body: { order: { orderId: 'synthetic-order' } },
      expected: 'usable_acknowledgment',
    },
    {
      name: 'malformed_success',
      provenance: 'synthetic_negative_case',
      mode: 'evaluation',
      body: null,
      expected: 'malformed_response',
    },
  ],
};
