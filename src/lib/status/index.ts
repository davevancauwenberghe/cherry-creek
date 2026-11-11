import { readStatusConfig } from './config.ts';
import { createStatusService } from './service.ts';

/** Process-wide singleton used by the API route. */
export const statusService = createStatusService(readStatusConfig(process.env));
export type { PublicStatus, ServerState } from './service.ts';
