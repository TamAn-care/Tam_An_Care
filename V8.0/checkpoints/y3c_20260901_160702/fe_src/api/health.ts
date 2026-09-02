import {
  apiRequest,
} from './client';

export async function getHealth():
  Promise<unknown> {
  return apiRequest('/api/health');
}
