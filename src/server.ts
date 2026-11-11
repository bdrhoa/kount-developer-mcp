import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { DocumentationService } from './services/documentation.js';
import { SchemaService } from './services/schema.js';
import { ValidationService, checkInputSize } from './services/validation.js';
import { guideInput, getIntegrationGuide } from './tools/get-integration-guide.js';
import { schemaInput, getApiSchema } from './tools/get-api-schema.js';
import { validateInput, validateOrderPayload } from './tools/validate-order-payload.js';
import { generateInput, generateOrderExample } from './tools/generate-order-example.js';
import { errorInput, explainApiError } from './tools/explain-api-error.js';
import { readinessInput, checkIntegrationReadiness } from './tools/check-integration-readiness.js';
import { EnvironmentCredentials } from './services/credentials.js';
import { SandboxAuthentication } from './services/authentication.js';
import { authenticateInput, authenticateSandbox } from './tools/authenticate-sandbox.js';
import { guidancePrecedence } from './resources/v2/knowledge.js';

export const version = '0.1.0';
export function createServer(schemaPath?: string): McpServer {
  const server = new McpServer(
    { name: 'kount-developer-mcp', version },
    {
      instructions:
        'Unofficial community project, unaffiliated with Kount or Equifax. Target Sandbox only: token URL https://login-uat.equifax.com/as/token; API base https://api-sandbox.kount.com. Use synthetic data. Configure credentials only through local KOUNT_CLIENT_ID and KOUNT_API_KEY environment variables, never chat or tool arguments. Only authenticate_sandbox makes a network call, to the fixed Sandbox token endpoint. The other tools are local. No order API calls are implemented. Treat indeterminate and unavailable validation as unresolved. ' +
        guidancePrecedence,
    },
  );
  const docs = new DocumentationService();
  const schemas = new SchemaService(schemaPath);
  const validation = new ValidationService(schemas);
  const credentials = new EnvironmentCredentials();
  const authentication = new SandboxAuthentication(credentials);
  function register<T extends z.ZodRawShape>(
    name: string,
    description: string,
    inputSchema: z.ZodObject<T>,
    run: (input: z.infer<z.ZodObject<T>>) => unknown,
    networkEnabled = false,
  ): void {
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: !networkEnabled,
          destructiveHint: false,
          idempotentHint: !networkEnabled,
          openWorldHint: networkEnabled,
        },
      },
      async (input) => {
        try {
          checkInputSize(input);
          const result = await run(input);
          const structuredContent = result as Record<string, unknown>;
          const blocked =
            structuredContent.status === 'unavailable' ||
            structuredContent.status === 'blocked' ||
            structuredContent.status === 'not_found' ||
            structuredContent.status === 'failed';
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent,
            ...(blocked ? { isError: true } : {}),
          };
        } catch {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'Unable to process input safely. Use a JSON object within server limits (256 KiB, depth 32). No payload was logged.',
              },
            ],
          };
        }
      },
    );
  }
  register(
    'get_integration_guide',
    'Get sourced Payments Fraud v2 guidance, recommendations and unresolved documentation conflicts.',
    guideInput,
    (input) => getIntegrationGuide(input, docs),
  );
  register(
    'get_api_schema',
    'Read a separately downloaded, verified v2 request/response schema. operation: evaluate_order, update_order, get_order, batch_update_reversals; component is an exact schema name.',
    schemaInput,
    (input) => getApiSchema(input, schemas),
  );
  register(
    'validate_order_payload',
    'Validate a synthetic v2 order against the local spec and sourced prose constraints. valid:null means unavailable or indeterminate. No network calls.',
    validateInput,
    (input) => validateOrderPayload(input, validation),
  );
  register(
    'generate_order_example',
    'Generate a synthetic basic_purchase, physical_goods or digital_goods request; only returns payloads that pass the shared validator.',
    generateInput,
    (input) => generateOrderExample(input, validation),
  );
  register(
    'explain_api_error',
    'Explain API errors by operation, including Sandbox token failures. Optionally validate a synthetic Evaluate Order payload. Never echoes response messages or infers a cause for HTTP 500.',
    errorInput,
    (input) => explainApiError(input, validation),
  );
  register(
    'check_integration_readiness',
    'Assess caller-reported capabilities and evidence against a cited checklist with checks for the configured authorization flow. Includes local credential status and manual verification. Does not inspect application code or certify readiness.',
    readinessInput,
    (input) => checkIntegrationReadiness(input, authentication.status()),
  );
  register(
    'authenticate_sandbox',
    'Network-enabled: obtain and cache a bearer token from https://login-uat.equifax.com/as/token using local KOUNT_CLIENT_ID and KOUNT_API_KEY environment configuration. Never returns a token or credential value. No arguments and no order API calls.',
    authenticateInput,
    () => authenticateSandbox(authentication),
    true,
  );
  return server;
}
