import { useState } from 'react'

import {
  assignCareAction,
  createWarningReview,
  executeCarePlanGovernance,
  executeCareTaskAction,
  getCareAction,
  getOperationalDashboard,
  getResidentCareView,
  getResidentIntegrationOverview,
  getWarningReview,
  reopenCareAction,
  resolveCareAction,
  startCareActionReview,
  transferCareAction,
  type HumanActor,
  type JsonObject,
} from '../../api/operational-care'

type MutationKind =
  | 'assign'
  | 'transfer'
  | 'start-review'
  | 'resolve'
  | 'reopen'
  | 'warning-review'
  | 'care-plan-governance'
  | 'care-task-execution'

const BODY_TYPES: Record<MutationKind, string> = {
  assign: 'AssignCareActionInput',
  transfer: 'TransferCareActionInput',
  'start-review': 'StartCareActionReviewInput',
  resolve: 'ResolveCareActionInput',
  reopen: 'ReopenCareActionInput',
  'warning-review': 'Opaque JSON body',
  'care-plan-governance': 'GovernanceBody',
  'care-task-execution': 'CareTaskExecutionInput',
}

function pretty(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function parseObject(value: string): JsonObject {
  let parsed: unknown

  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Request body is not valid JSON.')
  }

  if (
    parsed === null
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
  ) {
    throw new Error(
      'Request body must be a JSON object.',
    )
  }

  return parsed as JsonObject
}

export default function CareWorkPage() {
  const [actorId, setActorId] = useState('')
  const [actorRole, setActorRole] = useState('SUPERVISOR')

  const [residentId, setResidentId] = useState('')
  const [patternId, setPatternId] = useState('')
  const [warningId, setWarningId] = useState('')

  const [carePlanId, setCarePlanId] = useState('')
  const [carePlanAction, setCarePlanAction] = useState('')

  const [careTaskId, setCareTaskId] = useState('')
  const [careTaskAction, setCareTaskAction] = useState('')

  const [mutationKind, setMutationKind] =
    useState<MutationKind>('assign')

  const [bodyText, setBodyText] = useState('{}')

  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')

  const actor: HumanActor | undefined =
    actorId.trim()
      ? {
          actorId: actorId.trim(),
          actorRole: actorRole.trim(),
        }
      : undefined

  async function runAction(
    label: string,
    action: () => Promise<unknown>,
  ) {
    setLoading(true)
    setError('')

    try {
      const value = await action()
      setTitle(label)
      setResult(value)
    } catch (caught) {
      const err = caught as Error & {
        status?: number
        body?: unknown
      }

      setResult(null)

      const parts = [err.message]

      if (err.status) {
        parts.push(`HTTP ${err.status}`)
      }

      if (err.body !== undefined) {
        parts.push(pretty(err.body))
      }

      setError(parts.join('\n'))
    } finally {
      setLoading(false)
    }
  }

  function requireActor(): HumanActor {
    if (!actor) {
      throw new Error(
        'Actor ID is required for mutations.',
      )
    }

    return actor
  }

  function requireCareActionIds() {
    if (!residentId.trim() || !patternId.trim()) {
      throw new Error(
        'Resident ID and Pattern ID are required.',
      )
    }
  }

  async function performMutation(): Promise<unknown> {
    const humanActor = requireActor()
    const payload = parseObject(bodyText)

    if (mutationKind === 'warning-review') {
      return createWarningReview(
        payload,
        humanActor,
      )
    }

    if (mutationKind === 'care-plan-governance') {
      if (
        !carePlanId.trim()
        || !carePlanAction.trim()
      ) {
        throw new Error(
          'Care Plan ID and action are required.',
        )
      }

      return executeCarePlanGovernance(
        carePlanId.trim(),
        carePlanAction.trim(),
        payload,
        humanActor,
      )
    }

    if (mutationKind === 'care-task-execution') {
      if (
        !careTaskId.trim()
        || !careTaskAction.trim()
      ) {
        throw new Error(
          'Care Task ID and action are required.',
        )
      }

      return executeCareTaskAction(
        careTaskId.trim(),
        careTaskAction.trim(),
        payload,
        humanActor,
      )
    }

    requireCareActionIds()

    const resident = residentId.trim()
    const pattern = patternId.trim()

    if (mutationKind === 'assign') {
      return assignCareAction(
        resident,
        pattern,
        payload,
        humanActor,
      )
    }

    if (mutationKind === 'transfer') {
      return transferCareAction(
        resident,
        pattern,
        payload,
        humanActor,
      )
    }

    if (mutationKind === 'start-review') {
      return startCareActionReview(
        resident,
        pattern,
        payload,
        humanActor,
      )
    }

    if (mutationKind === 'resolve') {
      return resolveCareAction(
        resident,
        pattern,
        payload,
        humanActor,
      )
    }

    return reopenCareAction(
      resident,
      pattern,
      payload,
      humanActor,
    )
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 24 }}>
      <header>
        <p>Tam An Care V7.6</p>
        <h1>Operational Care Workspace</h1>
        <p>
          Read operations and controlled care workflow mutations.
        </p>
      </header>

      <section style={{ marginTop: 24 }}>
        <h2>Context</h2>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          <label>
            Actor ID
            <input
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
            />
          </label>

          <label>
            Actor role
            <input
              value={actorRole}
              onChange={(event) => setActorRole(event.target.value)}
            />
          </label>

          <label>
            Resident ID
            <input
              value={residentId}
              onChange={(event) => setResidentId(event.target.value)}
            />
          </label>

          <label>
            Pattern ID
            <input
              value={patternId}
              onChange={(event) => setPatternId(event.target.value)}
            />
          </label>

          <label>
            Warning ID
            <input
              value={warningId}
              onChange={(event) => setWarningId(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>Read operations</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runAction(
                'Dashboard',
                () => getOperationalDashboard(actor),
              )
            }
          >
            Dashboard
          </button>

          <button
            type="button"
            disabled={loading || !residentId.trim()}
            onClick={() =>
              void runAction(
                'Resident Care View',
                () =>
                  getResidentCareView(
                    residentId.trim(),
                    actor,
                  ),
              )
            }
          >
            Care View
          </button>

          <button
            type="button"
            disabled={loading || !residentId.trim()}
            onClick={() =>
              void runAction(
                'Resident Overview',
                () =>
                  getResidentIntegrationOverview(
                    residentId.trim(),
                    actor,
                  ),
              )
            }
          >
            Resident Overview
          </button>

          <button
            type="button"
            disabled={
              loading
              || !residentId.trim()
              || !patternId.trim()
            }
            onClick={() =>
              void runAction(
                'Care Action',
                () =>
                  getCareAction(
                    residentId.trim(),
                    patternId.trim(),
                    actor,
                  ),
              )
            }
          >
            Care Action
          </button>

          <button
            type="button"
            disabled={loading || !warningId.trim()}
            onClick={() =>
              void runAction(
                'Warning Review',
                () =>
                  getWarningReview(
                    warningId.trim(),
                    actor,
                  ),
              )
            }
          >
            Warning Review
          </button>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Controlled mutation</h2>

        <label>
          Operation
          <select
            value={mutationKind}
            onChange={(event) =>
              setMutationKind(
                event.target.value as MutationKind,
              )
            }
          >
            <option value="assign">Assign Care Action</option>
            <option value="transfer">Transfer Care Action</option>
            <option value="start-review">Start Review</option>
            <option value="resolve">Resolve Care Action</option>
            <option value="reopen">Reopen Care Action</option>
            <option value="warning-review">Create Warning Review</option>
            <option value="care-plan-governance">Care Plan Governance</option>
            <option value="care-task-execution">Care Task Execution</option>
          </select>
        </label>

        <p>
          Body contract: <code>{BODY_TYPES[mutationKind]}</code>
        </p>

        {mutationKind === 'care-plan-governance' ? (
          <div>
            <label>
              Care Plan ID
              <input
                value={carePlanId}
                onChange={(event) =>
                  setCarePlanId(event.target.value)
                }
              />
            </label>

            <label>
              Action
              <input
                value={carePlanAction}
                onChange={(event) =>
                  setCarePlanAction(event.target.value)
                }
              />
            </label>
          </div>
        ) : null}

        {mutationKind === 'care-task-execution' ? (
          <div>
            <label>
              Care Task ID
              <input
                value={careTaskId}
                onChange={(event) =>
                  setCareTaskId(event.target.value)
                }
              />
            </label>

            <label>
              Action
              <input
                value={careTaskAction}
                onChange={(event) =>
                  setCareTaskAction(event.target.value)
                }
              />
            </label>
          </div>
        ) : null}

        <label style={{ display: 'block', marginTop: 16 }}>
          Request body JSON
          <textarea
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            rows={12}
            spellCheck={false}
            style={{
              display: 'block',
              boxSizing: 'border-box',
              width: '100%',
              marginTop: 8,
              fontFamily: 'monospace',
            }}
          />
        </label>

        <button
          type="button"
          disabled={loading || !actor}
          onClick={() =>
            void runAction(
              `Mutation: ${mutationKind}`,
              performMutation,
            )
          }
          style={{ marginTop: 12 }}
        >
          Execute mutation
        </button>
      </section>

      {loading ? (
        <p role="status">Loading...</p>
      ) : null}

      {error ? (
        <section role="alert" style={{ marginTop: 24 }}>
          <h2>Request error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
        </section>
      ) : null}

      {result !== null ? (
        <section style={{ marginTop: 24 }}>
          <h2>{title}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
            {pretty(result)}
          </pre>
        </section>
      ) : null}
    </main>
  )
}
