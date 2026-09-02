import {
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listResidents,
} from '../../api/residents';
import {
  amendWorkEvent,
  createWorkEvent,
  getWorkEvent,
  listWorkEvents,
  listWorkEventTypes,
  verifyWorkEvent,
  voidWorkEvent,
  type PlannedClassification,
  type WorkEventStatus,
} from '../../api/operational-work';
import {
  useActor,
} from '../../auth/ActorContext';
import {
  ApiError,
} from '../../api/errors';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/feedback/FeedbackStates';

const STATUS_LABEL: Record<string, string> = {
  RECORDED: 'Đã ghi nhận',
  VERIFIED: 'Đã xác minh',
  COMPLETED: 'Đã hoàn thành',
  AMENDED: 'Đã điều chỉnh',
  VOIDED: 'Đã vô hiệu',
};

const PLAN_LABEL: Record<string, string> = {
  PLANNED: 'Theo kế hoạch',
  ADDITIONAL: 'Bổ sung',
  UNPLANNED: 'Phát sinh',
};

const PROJECTION_TYPE_CODES = new Set([
  'CARE_TASK_COMPLETION',
  'PERSONAL_CARE_ASSISTANCE',
  'TOILETING_ASSISTANCE',
]);

function errorText(error: unknown) {
  if (
    error instanceof ApiError ||
    error instanceof Error
  ) {
    return error.message;
  }

  return 'Không thể hoàn tất thao tác.';
}

function valueText(
  value: unknown,
  fallback = '—',
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  return String(value);
}

export function OperationsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [residentId, setResidentId] =
    useState('');
  const [typeId, setTypeId] =
    useState('');
  const [performedBy, setPerformedBy] =
    useState('');
  const [status, setStatus] =
    useState<WorkEventStatus | ''>('');
  const [sourceDomain, setSourceDomain] =
    useState('');
  const [limit, setLimit] =
    useState(50);

  const [selectedEventId, setSelectedEventId] =
    useState('');

  const [
    createResidentId,
    setCreateResidentId,
  ] = useState('');
  const [
    createTypeId,
    setCreateTypeId,
  ] = useState('');
  const [
    classification,
    setClassification,
  ] =
    useState<PlannedClassification>(
      'PLANNED',
    );
  const [quantity, setQuantity] =
    useState('1');
  const [note, setNote] =
    useState('');

  const [amendQuantity, setAmendQuantity] =
    useState('');
  const [amendNote, setAmendNote] =
    useState('');
  const [voidReason, setVoidReason] =
    useState('');

  const [actionError, setActionError] =
    useState('');

  const eventsQuery = useQuery({
    queryKey: [
      'operational-work-events',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
      residentId,
      typeId,
      performedBy,
      status,
      sourceDomain,
      limit,
    ],
    queryFn: () =>
      listWorkEvents(actor!, {
        residentId:
          residentId || undefined,
        workEventTypeId:
          typeId || undefined,
        performedBy:
          performedBy.trim() || undefined,
        status,
        sourceDomain:
          sourceDomain.trim() || undefined,
        limit,
      }),
    enabled: Boolean(actor),
  });

  const typesQuery = useQuery({
    queryKey: [
      'operational-work-event-types',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    queryFn: () =>
      listWorkEventTypes(actor!, 100),
    enabled: Boolean(actor),
  });

  const residentsQuery = useQuery({
    queryKey: [
      'operations-residents',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    queryFn: () =>
      listResidents(actor),
    enabled: Boolean(actor),
  });

  const detailQuery = useQuery({
    queryKey: [
      'operational-work-event-detail',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
      selectedEventId,
    ],
    queryFn: () =>
      getWorkEvent(
        actor!,
        selectedEventId,
      ),
    enabled:
      Boolean(actor) &&
      Boolean(selectedEventId),
  });

  const canGovern =
    actor?.actorRole === 'CARE_MANAGER' ||
    actor?.actorRole === 'SUPERVISOR';

  const typeById = useMemo(
    () =>
      new Map(
        (typesQuery.data?.items ?? []).map(
          (item) => [
            item.work_event_type_id,
            item,
          ],
        ),
      ),
    [typesQuery.data],
  );

  const manualTypes = useMemo(
    () =>
      (typesQuery.data?.items ?? []).filter(
        (item) =>
          !PROJECTION_TYPE_CODES.has(
            item.code,
          ),
      ),
    [typesQuery.data],
  );

  const residentById = useMemo(
    () =>
      new Map(
        (residentsQuery.data ?? []).map(
          ({ resident }) => [
            resident.residentId,
            resident,
          ],
        ),
      ),
    [residentsQuery.data],
  );

  async function refreshEvents() {
    await queryClient.invalidateQueries({
      queryKey: [
        'operational-work-events',
      ],
    });

    if (selectedEventId) {
      await queryClient.invalidateQueries({
        queryKey: [
          'operational-work-event-detail',
        ],
      });
    }
  }

  function clearFilters() {
    setResidentId('');
    setTypeId('');
    setPerformedBy('');
    setStatus('');
    setSourceDomain('');
    setLimit(50);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!actor) {
        throw new Error(
          'Chưa xác định người thực hiện.',
        );
      }

      if (!createTypeId) {
        throw new Error(
          'Chọn loại công việc.',
        );
      }

      const selectedType =
        typeById.get(createTypeId);

      if (
        selectedType &&
        PROJECTION_TYPE_CODES.has(
          selectedType.code,
        )
      ) {
        throw new Error(
          'Loại công việc này được hệ thống ghi nhận tự động từ nghiệp vụ nguồn.',
        );
      }

      if (
        selectedType?.resident_related &&
        !createResidentId
      ) {
        throw new Error(
          'Công việc này yêu cầu chọn người cao tuổi.',
        );
      }

      const numericQuantity =
        Number(quantity);

      if (
        !Number.isFinite(
          numericQuantity,
        ) ||
        numericQuantity <= 0
      ) {
        throw new Error(
          'Số lượng phải lớn hơn 0.',
        );
      }

      return createWorkEvent(
        actor,
        {
          residentId:
            createResidentId ||
            undefined,
          workEventTypeId:
            createTypeId,
          sourceDomain:
            'MANUAL_OPERATION',
          plannedClassification:
            classification,
          quantity:
            numericQuantity,
          note:
            note.trim() ||
            undefined,
          status: 'RECORDED',
        },
      );
    },
    onSuccess: async (event) => {
      setActionError('');
      setNote('');
      setSelectedEventId(
        event.work_event_id,
      );
      await refreshEvents();
    },
    onError: (error) =>
      setActionError(
        errorText(error),
      ),
  });

  const lifecycleMutation =
    useMutation({
      mutationFn: async ({
        action,
        id,
      }: {
        action:
          | 'VERIFY'
          | 'AMEND'
          | 'VOID';
        id: string;
      }) => {
        if (!actor) {
          throw new Error(
            'Chưa xác định người thực hiện.',
          );
        }

        if (action === 'VERIFY') {
          return verifyWorkEvent(
            actor,
            id,
          );
        }

        if (action === 'AMEND') {
          const payload: {
            quantity?: number;
            note?: string;
          } = {};

          if (
            amendQuantity.trim() !== ''
          ) {
            const nextQuantity =
              Number(amendQuantity);

            if (
              !Number.isFinite(
                nextQuantity,
              ) ||
              nextQuantity <= 0
            ) {
              throw new Error(
                'Số lượng điều chỉnh phải lớn hơn 0.',
              );
            }

            payload.quantity =
              nextQuantity;
          }

          if (
            amendNote.trim()
          ) {
            payload.note =
              amendNote.trim();
          }

          if (
            payload.quantity ===
              undefined &&
            payload.note ===
              undefined
          ) {
            throw new Error(
              'Nhập ít nhất số lượng hoặc ghi chú cần điều chỉnh.',
            );
          }

          return amendWorkEvent(
            actor,
            id,
            payload,
          );
        }

        if (!voidReason.trim()) {
          throw new Error(
            'Cần nhập lý do vô hiệu.',
          );
        }

        return voidWorkEvent(
          actor,
          id,
          voidReason.trim(),
        );
      },

      onSuccess: async () => {
        setActionError('');
        setAmendQuantity('');
        setAmendNote('');
        setVoidReason('');
        await refreshEvents();
      },

      onError: (error) =>
        setActionError(
          errorText(error),
        ),
    });

  if (!actor) {
    return (
      <ErrorState
        title="Chưa xác định người dùng"
        description="Cần có chủ thể con người hợp lệ để truy cập công việc vận hành."
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div className="eyebrow">
          Vận hành chăm sóc
        </div>

        <h1 className="page-title">
          Công việc vận hành
        </h1>

        <p className="page-description">
          Ghi nhận và rà soát bằng chứng
          công việc chăm sóc. Người thực
          hiện, vai trò, đơn vị và trọng
          số công việc do hệ thống phía
          máy chủ kiểm soát.
        </p>
      </header>

      <section className="operations-summary-grid">
        <div className="card resident-summary-card">
          <span className="metric-label">
            Kết quả đang hiển thị
          </span>

          <strong className="metric-value">
            {eventsQuery.data?.count ??
              '—'}
          </strong>
        </div>

        <div className="card resident-summary-card">
          <span className="metric-label">
            Giới hạn truy vấn
          </span>

          <strong className="metric-value">
            {eventsQuery.data?.limit ??
              limit}
          </strong>
        </div>

        <div className="card resident-summary-card">
          <span className="metric-label">
            Loại công việc hoạt động
          </span>

          <strong className="metric-value">
            {typesQuery.data?.count ??
              '—'}
          </strong>
        </div>
      </section>

      <section className="card operations-panel">
        <h2 className="section-title">
          Bộ lọc
        </h2>

        <div className="operations-filter-grid">
          <label className="field-group">
            <span className="field-label">
              Người cao tuổi
            </span>

            <select
              className="text-input"
              value={residentId}
              onChange={(event) =>
                setResidentId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Tất cả
              </option>

              {(residentsQuery.data ??
                []).map(
                ({ resident }) => (
                  <option
                    key={
                      resident.residentId
                    }
                    value={
                      resident.residentId
                    }
                  >
                    {resident.displayName}
                    {' — '}
                    {resident.residentCode}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Loại công việc
            </span>

            <select
              className="text-input"
              value={typeId}
              onChange={(event) =>
                setTypeId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Tất cả
              </option>

              {(typesQuery.data?.items ??
                []).map((type) => (
                <option
                  key={
                    type.work_event_type_id
                  }
                  value={
                    type.work_event_type_id
                  }
                >
                  {type.display_name_vi}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Người thực hiện
            </span>

            <input
              className="text-input"
              value={performedBy}
              placeholder="Mã người thực hiện"
              onChange={(event) =>
                setPerformedBy(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">
              Trạng thái
            </span>

            <select
              className="text-input"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    WorkEventStatus | '',
                )
              }
            >
              <option value="">
                Tất cả
              </option>

              {Object.entries(
                STATUS_LABEL,
              ).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Nguồn nghiệp vụ
            </span>

            <input
              className="text-input"
              value={sourceDomain}
              placeholder="Ví dụ: CARE_TASK"
              onChange={(event) =>
                setSourceDomain(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">
              Số bản ghi tối đa
            </span>

            <select
              className="text-input"
              value={limit}
              onChange={(event) =>
                setLimit(
                  Number(
                    event.target.value,
                  ),
                )
              }
            >
              <option value={25}>
                25
              </option>
              <option value={50}>
                50
              </option>
              <option value={100}>
                100
              </option>
            </select>
          </label>
        </div>

        <div className="operations-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={clearFilters}
          >
            Xóa bộ lọc
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              eventsQuery.refetch()
            }
          >
            Làm mới
          </button>
        </div>
      </section>

      <section className="card operations-panel">
        <h2 className="section-title">
          Ghi nhận công việc phát sinh
        </h2>

        <p className="page-description">
          Chỉ dùng cho công việc cần ghi
          nhận thủ công. Công việc hoàn
          thành từ nhiệm vụ chăm sóc, hỗ
          trợ chăm sóc cá nhân và hỗ trợ
          đi vệ sinh được hệ thống ghi
          nhận tự động từ nghiệp vụ nguồn.
        </p>

        <div className="operations-form-grid">
          <label className="field-group">
            <span className="field-label">
              Người cao tuổi
            </span>

            <select
              className="text-input"
              value={createResidentId}
              onChange={(event) =>
                setCreateResidentId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Không áp dụng
              </option>

              {(residentsQuery.data ??
                []).map(
                ({ resident }) => (
                  <option
                    key={
                      resident.residentId
                    }
                    value={
                      resident.residentId
                    }
                  >
                    {resident.displayName}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Loại công việc
            </span>

            <select
              className="text-input"
              value={createTypeId}
              onChange={(event) =>
                setCreateTypeId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Chọn loại công việc
              </option>

              {manualTypes.map(
                (type) => (
                  <option
                    key={
                      type.work_event_type_id
                    }
                    value={
                      type.work_event_type_id
                    }
                  >
                    {type.display_name_vi}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Phân loại
            </span>

            <select
              className="text-input"
              value={classification}
              onChange={(event) =>
                setClassification(
                  event.target
                    .value as
                    PlannedClassification,
                )
              }
            >
              {Object.entries(
                PLAN_LABEL,
              ).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Số lượng
            </span>

            <input
              className="text-input"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="field-group operations-wide-field">
            <span className="field-label">
              Ghi chú
            </span>

            <input
              className="text-input"
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <div className="operations-actions">
          <button
            type="button"
            className="primary-button"
            disabled={
              createMutation.isPending
            }
            onClick={() =>
              createMutation.mutate()
            }
          >
            {createMutation.isPending
              ? 'Đang ghi nhận…'
              : 'Ghi nhận công việc'}
          </button>
        </div>

        {actionError && (
          <div
            className="operations-inline-error"
            role="alert"
          >
            {actionError}
          </div>
        )}
      </section>

      {selectedEventId && (
        <section className="card operations-panel">
          <div className="operations-detail-header">
            <h2 className="section-title">
              Chi tiết ghi nhận
            </h2>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setSelectedEventId('')
              }
            >
              Đóng
            </button>
          </div>

          {detailQuery.isLoading && (
            <LoadingState
              title="Đang tải chi tiết"
            />
          )}

          {detailQuery.isError && (
            <ErrorState
              title="Không thể tải chi tiết"
              description={errorText(
                detailQuery.error,
              )}
            />
          )}

          {detailQuery.data && (
            <>
              <dl className="operations-detail-grid">
                <div>
                  <dt>Mã ghi nhận</dt>
                  <dd>
                    {detailQuery.data
                      .work_event_id}
                  </dd>
                </div>

                <div>
                  <dt>Loại công việc</dt>
                  <dd>
                    {typeById.get(
                      detailQuery.data
                        .work_event_type_id,
                    )?.display_name_vi ??
                      detailQuery.data
                        .work_event_type_id}
                  </dd>
                </div>

                <div>
                  <dt>Người cao tuổi</dt>
                  <dd>
                    {detailQuery.data
                      .resident_id
                      ? residentById.get(
                          detailQuery.data
                            .resident_id,
                        )?.displayName ??
                        detailQuery.data
                          .resident_id
                      : 'Không áp dụng'}
                  </dd>
                </div>

                <div>
                  <dt>Người thực hiện</dt>
                  <dd>
                    {
                      detailQuery.data
                        .performed_by
                    }
                  </dd>
                </div>

                <div>
                  <dt>Vai trò</dt>
                  <dd>
                    {
                      detailQuery.data
                        .performed_by_role
                    }
                  </dd>
                </div>

                <div>
                  <dt>Nguồn nghiệp vụ</dt>
                  <dd>
                    {
                      detailQuery.data
                        .source_domain
                    }
                  </dd>
                </div>

                <div>
                  <dt>Đối tượng nguồn</dt>
                  <dd>
                    {valueText(
                      detailQuery.data
                        .source_entity_type,
                    )}
                    {' / '}
                    {valueText(
                      detailQuery.data
                        .source_entity_id,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Phân loại</dt>
                  <dd>
                    {PLAN_LABEL[
                      detailQuery.data
                        .planned_classification
                    ] ??
                      detailQuery.data
                        .planned_classification}
                  </dd>
                </div>

                <div>
                  <dt>Số lượng</dt>
                  <dd>
                    {valueText(
                      detailQuery.data
                        .quantity,
                    )}
                    {' '}
                    {
                      detailQuery.data
                        .unit
                    }
                  </dd>
                </div>

                <div>
                  <dt>Trọng số</dt>
                  <dd>
                    {valueText(
                      detailQuery.data
                        .work_weight,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    {STATUS_LABEL[
                      detailQuery.data
                        .status
                    ] ??
                      detailQuery.data
                        .status}
                  </dd>
                </div>

                <div>
                  <dt>Thời điểm ghi nhận</dt>
                  <dd>
                    {new Date(
                      detailQuery.data
                        .occurred_at,
                    ).toLocaleString(
                      'vi-VN',
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Lý do</dt>
                  <dd>
                    {valueText(
                      detailQuery.data
                        .reason_code,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Ghi chú</dt>
                  <dd>
                    {valueText(
                      detailQuery.data
                        .note,
                    )}
                  </dd>
                </div>
              </dl>

              {canGovern &&
                detailQuery.data
                  .status !==
                  'VOIDED' && (
                  <div className="operations-governance">
                    {detailQuery.data
                      .status ===
                      'RECORDED' && (
                      <div className="operations-actions">
                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            lifecycleMutation
                              .isPending
                          }
                          onClick={() =>
                            lifecycleMutation.mutate(
                              {
                                action:
                                  'VERIFY',
                                id:
                                  detailQuery
                                    .data!
                                    .work_event_id,
                              },
                            )
                          }
                        >
                          Xác minh
                        </button>
                      </div>
                    )}

                    {[
                      'VERIFIED',
                      'COMPLETED',
                      'AMENDED',
                    ].includes(
                      detailQuery.data
                        .status,
                    ) && (
                      <div className="operations-form-grid">
                        <label className="field-group">
                          <span className="field-label">
                            Số lượng điều chỉnh
                          </span>

                          <input
                            className="text-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={
                              amendQuantity
                            }
                            placeholder={String(
                              detailQuery.data
                                .quantity,
                            )}
                            onChange={(
                              event,
                            ) =>
                              setAmendQuantity(
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <label className="field-group">
                          <span className="field-label">
                            Ghi chú điều chỉnh
                          </span>

                          <input
                            className="text-input"
                            value={
                              amendNote
                            }
                            onChange={(
                              event,
                            ) =>
                              setAmendNote(
                                event.target
                                  .value,
                              )
                            }
                          />
                        </label>

                        <div className="operations-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={
                              lifecycleMutation
                                .isPending
                            }
                            onClick={() =>
                              lifecycleMutation.mutate(
                                {
                                  action:
                                    'AMEND',
                                  id:
                                    detailQuery
                                      .data!
                                      .work_event_id,
                                },
                              )
                            }
                          >
                            Lưu điều chỉnh
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="operations-form-grid">
                      <label className="field-group">
                        <span className="field-label">
                          Lý do vô hiệu
                        </span>

                        <input
                          className="text-input"
                          value={
                            voidReason
                          }
                          onChange={(
                            event,
                          ) =>
                            setVoidReason(
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <div className="operations-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={
                            lifecycleMutation
                              .isPending
                          }
                          onClick={() =>
                            lifecycleMutation.mutate(
                              {
                                action:
                                  'VOID',
                                id:
                                  detailQuery
                                    .data!
                                    .work_event_id,
                              },
                            )
                          }
                        >
                          Vô hiệu ghi nhận
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
        </section>
      )}

      <section className="card operations-panel">
        <h2 className="section-title">
          Nhật ký công việc
        </h2>

        {eventsQuery.isLoading && (
          <LoadingState
            title="Đang tải công việc"
          />
        )}

        {eventsQuery.isError && (
          <ErrorState
            title="Không thể tải công việc"
            description={errorText(
              eventsQuery.error,
            )}
          />
        )}

        {!eventsQuery.isLoading &&
          !eventsQuery.isError &&
          (eventsQuery.data
            ?.items.length ?? 0) ===
            0 && (
            <EmptyState
              title="Chưa có công việc phù hợp"
              description="Thay đổi bộ lọc hoặc ghi nhận công việc mới."
            />
          )}

        {(eventsQuery.data
          ?.items.length ?? 0) > 0 && (
          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người cao tuổi</th>
                  <th>Công việc</th>
                  <th>Người thực hiện</th>
                  <th>Khối lượng</th>
                  <th>Nguồn</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>

              <tbody>
                {eventsQuery.data!.items.map(
                  (item) => {
                    const type =
                      typeById.get(
                        item.work_event_type_id,
                      );

                    const resident =
                      item.resident_id
                        ? residentById.get(
                            item.resident_id,
                          )
                        : undefined;

                    return (
                      <tr
                        key={
                          item.work_event_id
                        }
                      >
                        <td>
                          {new Date(
                            item.occurred_at,
                          ).toLocaleString(
                            'vi-VN',
                          )}
                        </td>

                        <td>
                          {resident
                            ?.displayName ??
                            item.resident_id ??
                            '—'}
                        </td>

                        <td>
                          {type
                            ?.display_name_vi ??
                            item.work_event_type_id}
                        </td>

                        <td>
                          {
                            item.performed_by
                          }
                          <br />
                          <small>
                            {
                              item.performed_by_role
                            }
                          </small>
                        </td>

                        <td>
                          {String(
                            item.quantity,
                          )}
                          {' '}
                          {item.unit}
                        </td>

                        <td>
                          {
                            item.source_domain
                          }
                        </td>

                        <td>
                          <span className="operations-status">
                            {STATUS_LABEL[
                              item.status
                            ] ??
                              item.status}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              setSelectedEventId(
                                item.work_event_id,
                              )
                            }
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
