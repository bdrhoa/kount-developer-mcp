import { z } from 'zod';
import type { SandboxAuthentication } from '../services/authentication.js';

export const authenticateInput = z.strictObject({});
export function authenticateSandbox(authentication: SandboxAuthentication) {
  return authentication.authenticate();
}
