export type HumanActor = {
  actorId: string
  actorRole: string
}

async function requestJson<T>(
  url: string,
  actor?: HumanActor,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (actor?.actorId) {
    headers['x-actor-id'] = actor.actorId
  }

  if (actor?.actorRole) {
    headers['x-actor-role'] = actor.actorRole
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  const text = await response.text()

  let body: unknown = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    const error = new Error(
      `HTTP ${response.status}: ${response.statusText}`,
    )

    ;(error as Error & {
      status?: number
      body?: unknown
    }).status = response.status

    ;(error as Error & {
      status?: number
      body?: unknown
    }).body = body

    throw error
  }

  return body as T
}

export function getOperationalDashboard<T = unknown>(
  actor?: HumanActor,
): Promise<T> {
  return requestJson<T>(
    '/api/operations/dashboard',
    actor,
  )
}

export function getResidentCareView<T = unknown>(
  residentId: string,
  actor?: HumanActor,
): Promise<T> {
  return requestJson<T>(
    `/api/operations/residents/${encodeURIComponent(
      residentId,
    )}/care-view`,
    actor,
  )
}

export function getResidentIntegrationOverview<T = unknown>(
  residentId: string,
  actor?: HumanActor,
): Promise<T> {
  return requestJson<T>(
    `/api/integration/residents/${encodeURIComponent(
      residentId,
    )}/overview`,
    actor,
  )
}

export function getCareAction<T = unknown>(
  residentId: string,
  patternId: string,
  actor?: HumanActor,
): Promise<T> {
  return requestJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}`,
    actor,
  )
}

export function getWarningReview<T = unknown>(
  warningId: string,
  actor?: HumanActor,
): Promise<T> {
  return requestJson<T>(
    `/api/warning-reviews/${encodeURIComponent(
      warningId,
    )}`,
    actor,
  )
}


// V7.6_PHASE_4B_MUTATION_API

export type JsonObject = Record<string, unknown>

async function postJson<T>(
  url: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  if (!actor.actorId.trim()) {
    throw new Error(
      'A human actor is required for protected mutations.',
    )
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-actor-id': actor.actorId,
      'x-actor-role': actor.actorRole,
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()

  let body: unknown = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    const error = new Error(
      `HTTP ${response.status}: ${response.statusText}`,
    )

    ;(error as Error & {
      status?: number
      body?: unknown
    }).status = response.status

    ;(error as Error & {
      status?: number
      body?: unknown
    }).body = body

    throw error
  }

  return body as T
}

export function assignCareAction<T = unknown>(
  residentId: string,
  patternId: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}/assign`,
    payload,
    actor,
  )
}

export function transferCareAction<T = unknown>(
  residentId: string,
  patternId: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}/transfer`,
    payload,
    actor,
  )
}

export function startCareActionReview<T = unknown>(
  residentId: string,
  patternId: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}/start-review`,
    payload,
    actor,
  )
}

export function resolveCareAction<T = unknown>(
  residentId: string,
  patternId: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}/resolve`,
    payload,
    actor,
  )
}

export function reopenCareAction<T = unknown>(
  residentId: string,
  patternId: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-actions/${encodeURIComponent(
      residentId,
    )}/${encodeURIComponent(patternId)}/reopen`,
    payload,
    actor,
  )
}

export function createWarningReview<T = unknown>(
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    '/api/warning-reviews',
    payload,
    actor,
  )
}

export function executeCarePlanGovernance<T = unknown>(
  carePlanId: string,
  action: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-plan-governance/${encodeURIComponent(
      carePlanId,
    )}/${encodeURIComponent(action)}`,
    payload,
    actor,
  )
}

export function executeCareTaskAction<T = unknown>(
  careTaskId: string,
  action: string,
  payload: JsonObject,
  actor: HumanActor,
): Promise<T> {
  return postJson<T>(
    `/api/care-task-execution/${encodeURIComponent(
      careTaskId,
    )}/${encodeURIComponent(action)}`,
    payload,
    actor,
  )
}
