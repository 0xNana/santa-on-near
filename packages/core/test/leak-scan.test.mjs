import { describe, expect, it } from 'vitest';
import { needlesFor } from '../../web/scripts/check-leaks.mjs';

describe('private-value scan after removing retired environment settings', () => {
  it('does not mistake public numeric budgets for credentials', () => {
    const result = needlesFor({ APP_DAILY_CAP: '2000000000000000', APP_MAX_GAS_PRICE: '3000000000' });
    expect(result.checked).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });
  it('still checks numeric credentials and unknown numeric settings', () => {
    const env = Object.fromEntries(['RELAYER_SECRET_KEY', 'API_TOKEN', 'ACCESS_CODE', 'SESSION_SECRET', 'UNKNOWN_VALUE', 'MAX_SECRET_KEY'].map(k => [k, '12345678901234567890']));
    expect(needlesFor(env).checked.map(x => x.name)).toEqual(Object.keys(env));
  });
  it('still checks private key bytes and opaque secrets', () => {
    const result = needlesFor({ NEAR_RELAYER_SECRET_KEY: 'ed25519:example-private-fixture', OTHER_SECRET: 'opaque-private-fixture' });
    expect(result.checked.map(x => x.name)).toEqual(['NEAR_RELAYER_SECRET_KEY', 'OTHER_SECRET']);
  });
});
