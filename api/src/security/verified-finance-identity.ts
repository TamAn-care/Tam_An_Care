export interface ServerVerifiedFinanceIdentity {
  actorId: string;
  actorRole: string;
  sessionId: string;
}

const verified = new WeakMap<
  object,
  Readonly<ServerVerifiedFinanceIdentity>
>();

export function publishVerifiedFinanceIdentity(
  request: object,
  identity: ServerVerifiedFinanceIdentity,
): void {
  if (
    !request ||
    typeof request !== 'object' ||
    !identity ||
    typeof identity.actorId !== 'string' ||
    !identity.actorId.trim() ||
    typeof identity.actorRole !== 'string' ||
    !identity.actorRole.trim() ||
    typeof identity.sessionId !== 'string' ||
    !identity.sessionId.trim()
  ) {
    throw new Error('FINANCE_VERIFIED_IDENTITY_INVALID');
  }

  if (verified.has(request)) {
    throw new Error('FINANCE_VERIFIED_IDENTITY_ALREADY_SET');
  }

  verified.set(request, Object.freeze({
    actorId: identity.actorId,
    actorRole: identity.actorRole,
    sessionId: identity.sessionId,
  }));
}

export function readVerifiedFinanceIdentity(
  request: object,
): Readonly<ServerVerifiedFinanceIdentity> | undefined {
  if (!request || typeof request !== 'object') {
    return undefined;
  }
  return verified.get(request);
}
