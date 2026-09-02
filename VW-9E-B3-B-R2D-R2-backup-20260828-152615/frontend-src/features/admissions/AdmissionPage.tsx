import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  approveClassification,
  createAdmission,
  createAdmissionDecision,
  createInitialAssessment,
  generateClassification,
  getAssessmentOverview,
  listAdmissions,
  type AdmissionCase,
  type ClassificationResult,
} from '../../api/admissions';

const CARE_LABEL:
  Record<string, string> = {
    INDEPENDENT:
      'Mức 1 — Tự phục vụ cơ bản',

    ASSISTED:
      'Mức 2 — Cần hỗ trợ một phần',

    HIGH_ASSISTANCE:
      'Mức 3 — Cần hỗ trợ nhiều',

    DEPENDENT:
      'Mức 4 — Phụ thuộc / chăm sóc toàn diện',
  };

const ADL_LABEL:
  Record<string, string> = {
    EATING:
      'Ăn uống',

    BATHING:
      'Tắm rửa / vệ sinh cá nhân',

    DRESSING:
      'Mặc quần áo',

    TOILETING:
      'Đi vệ sinh',

    MOBILITY:
      'Di chuyển',

    TRANSFER:
      'Thay đổi tư thế / chuyển vị trí',
  };

const ASSIST_LABEL:
  Record<string, string> = {
    INDEPENDENT:
      'Tự thực hiện',

    SUPERVISION:
      'Cần giám sát',

    PARTIAL_ASSISTANCE:
      'Hỗ trợ một phần',

    SUBSTANTIAL_ASSISTANCE:
      'Hỗ trợ nhiều',

    FULL_ASSISTANCE:
      'Phụ thuộc hoàn toàn',
  };

const panel:
  React.CSSProperties = {
    border:
      '1px solid #d9ddd9',

    borderRadius:
      12,

    padding:
      16,

    background:
      '#fff',
  };

const field:
  React.CSSProperties = {
    width:
      '100%',

    boxSizing:
      'border-box',

    padding:
      '9px 10px',

    border:
      '1px solid #cbd2cb',

    borderRadius:
      8,
  };

const button:
  React.CSSProperties = {
    padding:
      '9px 14px',

    borderRadius:
      8,

    border:
      '1px solid #89968a',

    cursor:
      'pointer',
  };

export function AdmissionPage() {
  const {
    actor,
  } = useActor();

  const [
    admissions,
    setAdmissions,
  ] =
    useState<AdmissionCase[]>(
      [],
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState('');

  const [
    name,
    setName,
  ] =
    useState('');

  const [
    dateOfBirth,
    setDateOfBirth,
  ] =
    useState('');

  const [
    gender,
    setGender,
  ] =
    useState('MALE');

  const [
    identity,
    setIdentity,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const activities =
    Object.keys(
      ADL_LABEL,
    );

  const [
    adl,
    setAdl,
  ] =
    useState<
      Record<string, string>
    >(
      Object.fromEntries(
        activities.map(
          (activity) => [
            activity,
            'INDEPENDENT',
          ],
        ),
      ),
    );

  const [
    orientation,
    setOrientation,
  ] =
    useState('');

  const [
    memory,
    setMemory,
  ] =
    useState('');

  const [
    mood,
    setMood,
  ] =
    useState('');

  const [
    dietType,
    setDietType,
  ] =
    useState('');

  const [
    swallowing,
    setSwallowing,
  ] =
    useState('');

  const [
    riskType,
    setRiskType,
  ] =
    useState('FALL');

  const [
    riskLevel,
    setRiskLevel,
  ] =
    useState('LOW');

  const [
    classification,
    setClassification,
  ] =
    useState<
      ClassificationResult | null
    >(null);

  const [
    approvedLevel,
    setApprovedLevel,
  ] =
    useState(
      'ASSISTED',
    );

  const [
    overrideReason,
    setOverrideReason,
  ] =
    useState('');

  const [
    overview,
    setOverview,
  ] =
    useState<any>(
      null,
    );

  const canApprove =
    actor?.actorRole ===
      'CARE_MANAGER' ||
    actor?.actorRole ===
      'SUPERVISOR';

  const selected =
    useMemo(
      () =>
        admissions.find(
          (item) =>
            item.admissionCaseId ===
            selectedId,
        ) ?? null,

      [
        admissions,
        selectedId,
      ],
    );

  async function refresh() {
    if (!actor) {
      return;
    }

    const result =
      await listAdmissions(
        actor,
      );

    setAdmissions(
      result.items,
    );
  }

  async function refreshOverview(
    id =
      selectedId,
  ) {
    if (
      !actor ||
      !id
    ) {
      return;
    }

    const result =
      await getAssessmentOverview(
        actor,
        id,
      );

    setOverview(
      result,
    );

    const current =
      result
        .classification;

    if (
      current
        ?.admission_care_classification_id
    ) {
      setClassification({
        classificationId:
          current
            .admission_care_classification_id,

        ruleSetVersion:
          current
            .rule_set_version,

        suggestedCareLevel:
          current
            .suggested_care_level,

        reviewStatus:
          current
            .review_status,

        triggeredRules:
          current
            .triggered_rules ?? [],

        redFlags:
          current
            .red_flags ?? [],

        missingRequirements:
          current
            .missing_requirements ?? [],

        reassessmentRequired:
          Boolean(
            current
              .reassessment_required,
          ),
      });
    }
  }

  async function run(
    action:
      () => Promise<void>,
  ) {
    setBusy(
      true,
    );

    setMessage(
      '',
    );

    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Có lỗi xảy ra.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  useEffect(
    () => {
      void refresh();
    },
    [actor],
  );

  useEffect(
    () => {
      if (
        selectedId
      ) {
        void refreshOverview(
          selectedId,
        );
      }
    },
    [selectedId],
  );

  if (!actor) {
    return (
      <section
        style={panel}
      >
        <h1>
          Tiếp nhận & đánh giá ban đầu
        </h1>

        <p>
          Vui lòng chọn phiên nhân sự để sử dụng phân hệ.
        </p>
      </section>
    );
  }

  return (
    <div
      style={{
        display:
          'grid',

        gap:
          16,
      }}
    >
      <header>
        <h1>
          Tiếp nhận & đánh giá ban đầu
        </h1>

        <p>
          Hồ sơ tiền tiếp nhận, đánh giá nhu cầu chăm sóc và quyết định của người có thẩm quyền.
        </p>
      </header>

      {message && (
        <section
          style={panel}
        >
          {message}
        </section>
      )}

      <section
        style={panel}
      >
        <h2>
          1. Hồ sơ tiền tiếp nhận
        </h2>

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(180px, 1fr))',

            gap:
              10,
          }}
        >
          <input
            style={field}
            placeholder="Họ và tên người cao tuổi"
            value={name}
            onChange={(
              event,
            ) =>
              setName(
                event.target.value,
              )
            }
          />

          <input
            style={field}
            type="date"
            value={
              dateOfBirth
            }
            onChange={(
              event,
            ) =>
              setDateOfBirth(
                event.target.value,
              )
            }
          />

          <select
            style={field}
            value={gender}
            onChange={(
              event,
            ) =>
              setGender(
                event.target.value,
              )
            }
          >
            <option
              value="MALE"
            >
              Nam
            </option>

            <option
              value="FEMALE"
            >
              Nữ
            </option>

            <option
              value="UNSPECIFIED"
            >
              Chưa xác định
            </option>
          </select>

          <input
            style={field}
            placeholder="CCCD / giấy tờ định danh"
            value={identity}
            onChange={(
              event,
            ) =>
              setIdentity(
                event.target.value,
              )
            }
          />
        </div>

        <p>
          <button
            style={button}
            disabled={busy}
            onClick={() =>
              void run(
                async () => {
                  const created =
                    await createAdmission(
                      actor,
                      {
                        prospectiveResidentName:
                          name,

                        dateOfBirth,

                        gender,

                        identityNumber:
                          identity,
                      },
                    );

                  await refresh();

                  setSelectedId(
                    created
                      .admissionCaseId,
                  );

                  setMessage(
                    'Đã tạo hồ sơ tiền tiếp nhận.',
                  );
                },
              )
            }
          >
            Tạo hồ sơ
          </button>
        </p>
      </section>

      <section
        style={panel}
      >
        <h2>
          2. Chọn hồ sơ
        </h2>

        <select
          style={field}
          value={
            selectedId
          }
          onChange={(
            event,
          ) =>
            setSelectedId(
              event.target.value,
            )
          }
        >
          <option value="">
            Chọn hồ sơ
          </option>

          {admissions.map(
            (item) => (
              <option
                key={
                  item
                    .admissionCaseId
                }
                value={
                  item
                    .admissionCaseId
                }
              >
                {
                  item
                    .admissionCode
                }
                {' — '}
                {
                  item
                    .prospectiveResidentName
                }
                {' — '}
                {
                  item.status
                }
              </option>
            ),
          )}
        </select>
      </section>

      {selected && (
        <>
          <section
            style={panel}
          >
            <h2>
              3. Hoạt động sinh hoạt hàng ngày — ADL
            </h2>

            <div
              style={{
                display:
                  'grid',

                gap:
                  8,
              }}
            >
              {activities.map(
                (
                  activity,
                ) => (
                  <label
                    key={
                      activity
                    }
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        'minmax(220px,1fr) minmax(220px,1fr)',

                      gap:
                        10,

                      alignItems:
                        'center',
                    }}
                  >
                    <span>
                      {
                        ADL_LABEL[
                          activity
                        ]
                      }
                    </span>

                    <select
                      style={field}
                      value={
                        adl[
                          activity
                        ]
                      }
                      onChange={(
                        event,
                      ) =>
                        setAdl(
                          (
                            previous,
                          ) => ({
                            ...previous,

                            [activity]:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    >
                      {Object.entries(
                        ASSIST_LABEL,
                      ).map(
                        ([
                          code,
                          label,
                        ]) => (
                          <option
                            key={
                              code
                            }
                            value={
                              code
                            }
                          >
                            {
                              label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                ),
              )}
            </div>
          </section>

          <section
            style={panel}
          >
            <h2>
              4. Nhận thức, tinh thần và dinh dưỡng
            </h2>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  'repeat(auto-fit, minmax(190px,1fr))',

                gap:
                  10,
              }}
            >
              <input
                style={field}
                placeholder="Định hướng / nhận biết"
                value={
                  orientation
                }
                onChange={(
                  event,
                ) =>
                  setOrientation(
                    event
                      .target
                      .value,
                  )
                }
              />

              <input
                style={field}
                placeholder="Trí nhớ"
                value={
                  memory
                }
                onChange={(
                  event,
                ) =>
                  setMemory(
                    event
                      .target
                      .value,
                  )
                }
              />

              <input
                style={field}
                placeholder="Trạng thái cảm xúc"
                value={
                  mood
                }
                onChange={(
                  event,
                ) =>
                  setMood(
                    event
                      .target
                      .value,
                  )
                }
              />

              <input
                style={field}
                placeholder="Chế độ ăn"
                value={
                  dietType
                }
                onChange={(
                  event,
                ) =>
                  setDietType(
                    event
                      .target
                      .value,
                  )
                }
              />

              <input
                style={field}
                placeholder="Khả năng nhai nuốt"
                value={
                  swallowing
                }
                onChange={(
                  event,
                ) =>
                  setSwallowing(
                    event
                      .target
                      .value,
                  )
                }
              />
            </div>
          </section>

          <section
            style={panel}
          >
            <h2>
              5. Nguy cơ lâm sàng
            </h2>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap:
                  10,
              }}
            >
              <select
                style={field}
                value={
                  riskType
                }
                onChange={(
                  event,
                ) =>
                  setRiskType(
                    event
                      .target
                      .value,
                  )
                }
              >
                <option
                  value="FALL"
                >
                  Nguy cơ té ngã
                </option>

                <option
                  value="PRESSURE_INJURY"
                >
                  Nguy cơ loét tì đè
                </option>

                <option
                  value="ASPIRATION"
                >
                  Nguy cơ sặc
                </option>

                <option
                  value="OTHER"
                >
                  Nguy cơ khác
                </option>
              </select>

              <select
                style={field}
                value={
                  riskLevel
                }
                onChange={(
                  event,
                ) =>
                  setRiskLevel(
                    event
                      .target
                      .value,
                  )
                }
              >
                <option value="LOW">
                  Thấp
                </option>

                <option value="MODERATE">
                  Trung bình
                </option>

                <option value="HIGH">
                  Cao
                </option>

                <option value="CRITICAL">
                  Rất cao / nghiêm trọng
                </option>
              </select>
            </div>

            <p>
              <button
                style={button}
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      await createInitialAssessment(
                        actor,

                        selected
                          .admissionCaseId,

                        {
                          assessmentType:
                            'INITIAL',

                          adl:
                            activities.map(
                              (
                                activity,
                              ) => ({
                                activityCode:
                                  activity,

                                assistanceLevel:
                                  adl[
                                    activity
                                  ],
                              }),
                            ),

                          cognitive: {
                            orientation,
                            memory,
                            mood,
                          },

                          nutrition: {
                            dietType,

                            swallowingStatus:
                              swallowing,
                          },

                          risks: [
                            {
                              riskType,
                              riskLevel,
                            },
                          ],
                        },
                      );

                      await refreshOverview();

                      setMessage(
                        'Đã lưu đánh giá ban đầu.',
                      );
                    },
                  )
                }
              >
                Lưu đánh giá
              </button>

              {' '}

              <button
                style={button}
                disabled={busy}
                onClick={() =>
                  void run(
                    async () => {
                      const result =
                        await generateClassification(
                          actor,

                          selected
                            .admissionCaseId,
                        );

                      setClassification(
                        result,
                      );

                      if (
                        result
                          .suggestedCareLevel
                      ) {
                        setApprovedLevel(
                          result
                            .suggestedCareLevel,
                        );
                      }

                      setMessage(
                        'Hệ thống đã tạo đề xuất mức chăm sóc. Đề xuất chưa phải phê duyệt.',
                      );
                    },
                  )
                }
              >
                Tạo đề xuất chăm sóc
              </button>
            </p>
          </section>

          <section
            style={panel}
          >
            <h2>
              6. Phân loại nhu cầu chăm sóc
            </h2>

            {!classification ? (
              <p>
                Chưa có đề xuất.
              </p>
            ) : (
              <>
                <p>
                  <strong>
                    Hệ thống đề xuất:
                  </strong>{' '}

                  {
                    classification
                      .suggestedCareLevel
                      ? CARE_LABEL[
                          classification
                            .suggestedCareLevel
                        ]
                      : 'Chưa đủ dữ liệu'
                  }
                </p>

                <p>
                  Bộ quy tắc:{' '}
                  {
                    classification
                      .ruleSetVersion
                  }
                </p>

                {classification
                  .missingRequirements
                  .length > 0 && (
                  <p>
                    Thiếu ADL:{' '}
                    {
                      classification
                        .missingRequirements
                        .join(', ')
                    }
                  </p>
                )}

                {classification
                  .redFlags
                  .length > 0 && (
                  <p>
                    Cảnh báo:{' '}
                    {
                      classification
                        .redFlags
                        .join(', ')
                    }
                  </p>
                )}

                {canApprove && (
                  <div
                    style={{
                      display:
                        'grid',

                      gap:
                        10,
                    }}
                  >
                    <select
                      style={field}
                      value={
                        approvedLevel
                      }
                      onChange={(
                        event,
                      ) =>
                        setApprovedLevel(
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      {Object.entries(
                        CARE_LABEL,
                      ).map(
                        ([
                          code,
                          label,
                        ]) => (
                          <option
                            key={
                              code
                            }
                            value={
                              code
                            }
                          >
                            {
                              label
                            }
                          </option>
                        ),
                      )}
                    </select>

                    <input
                      style={field}
                      placeholder="Lý do nếu thay đổi đề xuất hệ thống"
                      value={
                        overrideReason
                      }
                      onChange={(
                        event,
                      ) =>
                        setOverrideReason(
                          event
                            .target
                            .value,
                        )
                      }
                    />

                    <button
                      style={button}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          async () => {
                            await approveClassification(
                              actor,

                              selected
                                .admissionCaseId,

                              classification
                                .classificationId,

                              {
                                approvedCareLevel:
                                  approvedLevel,

                                overrideReason,
                              },
                            );

                            await refreshOverview();

                            setMessage(
                              'Đã ghi nhận phê duyệt của người có thẩm quyền.',
                            );
                          },
                        )
                      }
                    >
                      Phê duyệt mức chăm sóc
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {canApprove && (
            <section
              style={panel}
            >
              <h2>
                7. Quyết định tiếp nhận
              </h2>

              <div
                style={{
                  display:
                    'flex',

                  flexWrap:
                    'wrap',

                  gap:
                    8,
                }}
              >
                {[
                  [
                    'APPROVED',
                    'Đủ điều kiện tiếp nhận',
                  ],

                  [
                    'CONDITIONAL',
                    'Tiếp nhận có điều kiện',
                  ],

                  [
                    'FURTHER_ASSESSMENT',
                    'Cần đánh giá thêm',
                  ],

                  [
                    'NOT_SUITABLE',
                    'Chưa phù hợp tiếp nhận',
                  ],
                ].map(
                  ([
                    code,
                    label,
                  ]) => (
                    <button
                      key={
                        code
                      }
                      style={
                        button
                      }
                      disabled={
                        busy
                      }
                      onClick={() =>
                        void run(
                          async () => {
                            await createAdmissionDecision(
                              actor,

                              selected
                                .admissionCaseId,

                              {
                                decision:
                                  code,
                              },
                            );

                            await refreshOverview();

                            setMessage(
                              `Đã ghi nhận: ${label}.`,
                            );
                          },
                        )
                      }
                    >
                      {
                        label
                      }
                    </button>
                  ),
                )}
              </div>
            </section>
          )}

          {overview && (
            <section
              style={panel}
            >
              <h2>
                8. Tóm tắt hồ sơ
              </h2>

              <p>
                ADL đã đánh giá:{' '}
                {
                  overview.adl
                    ?.length ??
                  0
                }
                /6
              </p>

              <p>
                Nguy cơ ghi nhận:{' '}
                {
                  overview.risks
                    ?.length ??
                  0
                }
              </p>

              <p>
                Phân loại:{' '}
                {
                  overview
                    .classification
                    ?.review_status ??
                  'Chưa có'
                }
              </p>

              <p>
                Quyết định:{' '}
                {
                  overview
                    .decision
                    ?.decision ??
                  'Chưa có'
                }
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
