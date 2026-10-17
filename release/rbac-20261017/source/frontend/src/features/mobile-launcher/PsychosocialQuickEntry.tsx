import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  HumanActorSession,
} from '../../types/actor';

import {
  createPsychosocialDailyObservation,
  listPsychosocialAccessibleResidents,
} from '../../api/psychosocial-daily-observation';

import type {
  PsychosocialAccessibleResident,
  PsychosocialEmotionalState,
  PsychosocialEnvironmentIntegration,
  PsychosocialFollowUpStatus,
  PsychosocialInterventionCode,
  PsychosocialSocialInteraction,
  PsychosocialYesPartialNo,
} from '../../api/psychosocial-daily-observation';

import {
  getActivityDailyContext,
} from '../../api/activity-rehabilitation';

import type {
  ActivityDailyContextItem,
} from '../../api/activity-rehabilitation';


interface Props {
  actor:
    | HumanActorSession
    | null
    | undefined;
}


type TouchOption<T extends string> = {
  value: T;
  label: string;
};


const EMOTIONAL_OPTIONS:
  TouchOption<PsychosocialEmotionalState>[] = [
    { value: 'POSITIVE', label: 'Vui vẻ / tích cực' },
    { value: 'STABLE', label: 'Ổn định' },
    { value: 'WITHDRAWN', label: 'Thu mình / ít nói' },
    { value: 'ANXIOUS_RESTLESS', label: 'Lo âu / bồn chồn' },
    { value: 'SAD_REDUCED_INTEREST', label: 'Buồn / giảm hứng thú' },
    { value: 'IRRITABLE_AGITATED', label: 'Cáu gắt / kích động' },
    { value: 'UNUSUAL_CHANGE', label: 'Thay đổi bất thường' },
  ];


const SOCIAL_OPTIONS:
  TouchOption<PsychosocialSocialInteraction>[] = [
    { value: 'PROACTIVE', label: 'Chủ động giao tiếp' },
    { value: 'NORMAL', label: 'Giao tiếp bình thường' },
    { value: 'LOW', label: 'Ít giao tiếp' },
    { value: 'REFUSED', label: 'Từ chối giao tiếp' },
    { value: 'GOOD_WITH_OTHERS', label: 'Tương tác tốt' },
    { value: 'CONFLICT', label: 'Có xung đột' },
    { value: 'NEEDS_INTEGRATION_SUPPORT', label: 'Cần hỗ trợ hòa nhập' },
  ];


const YES_PARTIAL_NO:
  TouchOption<PsychosocialYesPartialNo>[] = [
    { value: 'YES', label: 'Tốt / Có' },
    { value: 'PARTIAL', label: 'Một phần' },
    { value: 'NO', label: 'Khó / Không' },
  ];


const ENVIRONMENT_OPTIONS:
  TouchOption<PsychosocialEnvironmentIntegration>[] = [
    { value: 'GOOD', label: 'Hòa nhập tốt' },
    { value: 'ADAPTING', label: 'Đang thích nghi' },
    { value: 'DIFFICULT', label: 'Khó thích nghi' },
  ];


const FOLLOW_UP_OPTIONS:
  TouchOption<PsychosocialFollowUpStatus>[] = [
    { value: 'NORMAL', label: 'Bình thường' },
    { value: 'MONITOR', label: 'Cần theo dõi' },
    { value: 'COORDINATED', label: 'Cần phối hợp' },
  ];


const INTERVENTION_OPTIONS:
  TouchOption<PsychosocialInterventionCode>[] = [
    { value: 'EMOTIONAL_SUPPORT', label: 'Trò chuyện / hỗ trợ cảm xúc' },
    { value: 'INTEGRATION_SUPPORT', label: 'Hỗ trợ hòa nhập' },
    { value: 'GROUP_ACTIVITY', label: 'Hỗ trợ hoạt động nhóm' },
    { value: 'FAMILY_CONNECTION', label: 'Kết nối gia đình' },
    { value: 'CONFLICT_SUPPORT', label: 'Hỗ trợ xử lý xung đột' },
    { value: 'PARTICIPATION_ENCOURAGEMENT', label: 'Khuyến khích tham gia' },
    { value: 'CASE_FOLLOW_UP', label: 'Theo dõi trường hợp' },
    { value: 'REFER_OTHER_DEPARTMENT', label: 'Phối hợp bộ phận khác' },
  ];


function dayBounds() {
  const start = new Date();

  start.setHours(
    0,
    0,
    0,
    0,
  );

  const end =
    new Date(start);

  end.setDate(
    end.getDate() + 1,
  );

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}


function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return 'Không thể hoàn thành thao tác.';
}


function TouchGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: TouchOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: '12px',
          fontWeight: 800,
          color: '#334155',
          marginBottom: '7px',
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '7px',
        }}
      >
        {options.map((option) => {
          const selected =
            value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(option.value)
              }
              style={{
                minHeight: '38px',
                padding: '8px 11px',
                borderRadius: '14px',
                border:
                  selected
                    ? '2px solid #0f766e'
                    : '1px solid #cbd5e1',
                background:
                  selected
                    ? '#ccfbf1'
                    : '#ffffff',
                color:
                  selected
                    ? '#115e59'
                    : '#334155',
                fontSize: '12px',
                fontWeight:
                  selected
                    ? 800
                    : 600,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


export function PsychosocialQuickEntry({
  actor,
}: Props) {
  const [residents, setResidents] =
    useState<PsychosocialAccessibleResident[]>([]);

  const [
    residentsLoading,
    setResidentsLoading,
  ] = useState(false);

  const [
    selectedResidentId,
    setSelectedResidentId,
  ] = useState('');

  const [
    activityItems,
    setActivityItems,
  ] = useState<ActivityDailyContextItem[]>([]);

  const [
    activityLoading,
    setActivityLoading,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [
    emotionalState,
    setEmotionalState,
  ] =
    useState<PsychosocialEmotionalState | ''>('');

  const [
    socialInteraction,
    setSocialInteraction,
  ] =
    useState<PsychosocialSocialInteraction | ''>('');

  const [
    staffCooperation,
    setStaffCooperation,
  ] =
    useState<PsychosocialYesPartialNo | ''>('');

  const [
    environmentIntegration,
    setEnvironmentIntegration,
  ] =
    useState<PsychosocialEnvironmentIntegration | ''>('');

  const [
    dailyActivityInitiative,
    setDailyActivityInitiative,
  ] =
    useState<PsychosocialYesPartialNo | ''>('');

  const [
    followUpStatus,
    setFollowUpStatus,
  ] =
    useState<PsychosocialFollowUpStatus | ''>('');

  const [
    noteworthyBehavior,
    setNoteworthyBehavior,
  ] = useState(false);

  const [
    noteworthyBehaviorNote,
    setNoteworthyBehaviorNote,
  ] = useState('');

  const [
    notableEventNote,
    setNotableEventNote,
  ] = useState('');

  const [
    interventions,
    setInterventions,
  ] =
    useState<PsychosocialInterventionCode[]>([]);

  const [
    coordinationDestination,
    setCoordinationDestination,
  ] = useState('');

  const [
    coordinationReason,
    setCoordinationReason,
  ] = useState('');

  const [
    professionalNote,
    setProfessionalNote,
  ] = useState('');

  const [
    showDetails,
    setShowDetails,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const isProfessional =
    actor?.actorRole === 'PSYCHOLOGIST' ||
    actor?.actorRole === 'SOCIAL_WORKER';


  const selectedResident =
    useMemo(
      () =>
        residents.find(
          (resident) =>
            resident.residentId ===
            selectedResidentId,
        ) ?? null,
      [
        residents,
        selectedResidentId,
      ],
    );


  useEffect(
    () => {
      let cancelled = false;

      async function load() {
        if (
          !actor ||
          !isProfessional
        ) {
          setResidents([]);
          return;
        }

        setResidentsLoading(true);
        setError(null);

        try {
          const result =
            await listPsychosocialAccessibleResidents(
              actor,
            );

          if (!cancelled) {
            setResidents(
              result.items,
            );
          }
        } catch (err) {
          if (!cancelled) {
            setResidents([]);
            setError(
              errorMessage(err),
            );
          }
        } finally {
          if (!cancelled) {
            setResidentsLoading(false);
          }
        }
      }

      void load();

      return () => {
        cancelled = true;
      };
    },
    [
      actor,
      isProfessional,
    ],
  );


  useEffect(
    () => {
      let cancelled = false;

      async function loadActivity() {
        if (
          !actor ||
          !isProfessional ||
          !selectedResidentId
        ) {
          setActivityItems([]);
          return;
        }

        setActivityLoading(true);
        setError(null);

        try {
          const bounds =
            dayBounds();

          const result =
            await getActivityDailyContext(
              actor,
              selectedResidentId,
              bounds.from,
              bounds.to,
            );

          if (!cancelled) {
            setActivityItems(
              result.items,
            );
          }
        } catch (err) {
          if (!cancelled) {
            setActivityItems([]);
            setError(
              errorMessage(err),
            );
          }
        } finally {
          if (!cancelled) {
            setActivityLoading(false);
          }
        }
      }

      void loadActivity();

      return () => {
        cancelled = true;
      };
    },
    [
      actor,
      isProfessional,
      selectedResidentId,
    ],
  );


  const toggleIntervention = (
    code: PsychosocialInterventionCode,
  ) => {
    setInterventions(
      (previous) =>
        previous.includes(code)
          ? previous.filter(
              (item) =>
                item !== code,
            )
          : [
              ...previous,
              code,
            ],
    );
  };


  const resetObservation = () => {
    setEmotionalState('');
    setSocialInteraction('');
    setStaffCooperation('');
    setEnvironmentIntegration('');
    setDailyActivityInitiative('');
    setFollowUpStatus('');
    setNoteworthyBehavior(false);
    setNoteworthyBehaviorNote('');
    setNotableEventNote('');
    setInterventions([]);
    setCoordinationDestination('');
    setCoordinationReason('');
    setProfessionalNote('');
    setShowDetails(false);
  };


  const save = async () => {
    setError(null);
    setSuccess(null);

    if (
      !actor ||
      !isProfessional
    ) {
      setError(
        'Chức năng này chỉ dành cho nhân viên Tâm lý – CTXH.',
      );
      return;
    }

    if (!selectedResidentId) {
      setError(
        'Vui lòng chọn người cao tuổi.',
      );
      return;
    }

    if (!emotionalState) {
      setError(
        'Vui lòng chọn trạng thái cảm xúc.',
      );
      return;
    }

    if (!socialInteraction) {
      setError(
        'Vui lòng chọn mức độ giao tiếp / tương tác.',
      );
      return;
    }

    if (!followUpStatus) {
      setError(
        'Vui lòng chọn hướng theo dõi.',
      );
      return;
    }

    if (
      noteworthyBehavior &&
      !noteworthyBehaviorNote.trim()
    ) {
      setError(
        'Khi có hành vi đáng chú ý, cần ghi mô tả ngắn.',
      );
      return;
    }

    if (
      followUpStatus === 'COORDINATED' &&
      (
        !coordinationDestination.trim() ||
        !coordinationReason.trim()
      )
    ) {
      setError(
        'Cần ghi bộ phận phối hợp và lý do phối hợp.',
      );
      return;
    }

    setSubmitting(true);

    try {
      await createPsychosocialDailyObservation(
        actor,
        {
          residentId:
            selectedResidentId,

          observedAt:
            new Date().toISOString(),

          emotionalState,

          socialInteraction,

          staffCooperation:
            staffCooperation || null,

          environmentIntegration:
            environmentIntegration || null,

          dailyActivityInitiative:
            dailyActivityInitiative || null,

          noteworthyBehavior,

          noteworthyBehaviorNote:
            noteworthyBehavior
              ? (
                  noteworthyBehaviorNote.trim() ||
                  null
                )
              : null,

          notableEventNote:
            notableEventNote.trim() ||
            null,

          followUpStatus,

          coordinationDestination:
            followUpStatus === 'COORDINATED'
              ? coordinationDestination.trim()
              : null,

          coordinationReason:
            followUpStatus === 'COORDINATED'
              ? coordinationReason.trim()
              : null,

          interventionCodes:
            interventions,

          activityRefs:
            activityItems.map(
              (item) => ({
                activitySessionId:
                  item.activitySessionId,

                participationId:
                  item.participation
                    ?.participationId ??
                  null,
              }),
            ),

          professionalNote:
            professionalNote.trim() ||
            null,
        },
      );

      setSuccess(
        selectedResident
          ? `Đã ghi nhận cho ${selectedResident.displayName}.`
          : 'Đã lưu ghi nhận Tâm lý – CTXH.',
      );

      resetObservation();
    } catch (err) {
      setError(
        errorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  };


  if (!isProfessional) {
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#9a3412',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        Chức năng này chỉ dành cho nhân viên
        Tâm lý – CTXH.
      </div>
    );
  }


  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div
        style={{
          background: '#ecfeff',
          border: '1px solid #a5f3fc',
          borderRadius: '18px',
          padding: '14px',
        }}
      >
        <div
          style={{
            fontSize: '15px',
            fontWeight: 900,
            color: '#155e75',
          }}
        >
          Chạm – ghi nhận Tâm lý & CTXH
        </div>

        <div
          style={{
            marginTop: '4px',
            fontSize: '11px',
            lineHeight: 1.5,
            color: '#0e7490',
          }}
        >
          Ghi nhận tình trạng quan sát hôm nay.
          Không đánh giá dấu hiệu sinh tồn,
          chẩn đoán hay nghiệp vụ y tế.
        </div>
      </div>


      <div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            color: '#334155',
            marginBottom: '7px',
          }}
        >
          1. Người cao tuổi
        </div>

        {residentsLoading ? (
          <div
            style={{
              padding: '12px',
              borderRadius: '14px',
              background: '#f8fafc',
              fontSize: '12px',
              color: '#64748b',
            }}
          >
            Đang tải danh sách được phân quyền...
          </div>
        ) : (
          <select
            value={selectedResidentId}
            onChange={(event) => {
              setSelectedResidentId(
                event.target.value,
              );

              setSuccess(null);
              setError(null);
            }}
            style={{
              width: '100%',
              minHeight: '44px',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              padding: '0 12px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            <option value="">
              Chọn người cao tuổi
            </option>

            {residents.map(
              (resident) => (
                <option
                  key={resident.residentId}
                  value={resident.residentId}
                >
                  {resident.displayName}
                  {resident.room
                    ? ` • Phòng ${resident.room}`
                    : ''}
                  {resident.bed
                    ? ` • Giường ${resident.bed}`
                    : ''}
                </option>
              ),
            )}
          </select>
        )}

        {!residentsLoading &&
          residents.length === 0 && (
            <div
              style={{
                marginTop: '7px',
                fontSize: '11px',
                color: '#64748b',
              }}
            >
              Hiện chưa có người cao tuổi được
              phân quyền Tâm lý–CTXH.
            </div>
          )}
      </div>


      {selectedResident && (
        <>
          <TouchGroup
            label="2. Cảm xúc quan sát hôm nay *"
            options={EMOTIONAL_OPTIONS}
            value={emotionalState}
            onChange={setEmotionalState}
          />

          <TouchGroup
            label="3. Giao tiếp / tương tác xã hội *"
            options={SOCIAL_OPTIONS}
            value={socialInteraction}
            onChange={setSocialInteraction}
          />

          <TouchGroup
            label="4. Hợp tác với nhân viên"
            options={YES_PARTIAL_NO}
            value={staffCooperation}
            onChange={setStaffCooperation}
          />

          <TouchGroup
            label="5. Hòa nhập môi trường"
            options={ENVIRONMENT_OPTIONS}
            value={environmentIntegration}
            onChange={setEnvironmentIntegration}
          />

          <TouchGroup
            label="6. Chủ động hoạt động hằng ngày"
            options={YES_PARTIAL_NO}
            value={dailyActivityInitiative}
            onChange={setDailyActivityInitiative}
          />


          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#334155',
              }}
            >
              Hoạt động thực tế hôm nay
            </div>

            {activityLoading ? (
              <div
                style={{
                  marginTop: '7px',
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                Đang tải hoạt động...
              </div>
            ) : activityItems.length === 0 ? (
              <div
                style={{
                  marginTop: '7px',
                  fontSize: '11px',
                  color: '#64748b',
                }}
              >
                Không có hoạt động được ghi nhận
                trong lịch hôm nay.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  marginTop: '8px',
                }}
              >
                {activityItems.map(
                  (item) => (
                    <div
                      key={item.activitySessionId}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '9px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        {item.programTitle ||
                          item.sessionType}
                      </div>

                      <div
                        style={{
                          marginTop: '3px',
                          fontSize: '10px',
                          color: '#64748b',
                        }}
                      >
                        {new Date(
                          item.scheduledAt,
                        ).toLocaleTimeString(
                          'vi-VN',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}

                        {item.location
                          ? ` • ${item.location}`
                          : ''}

                        {item.participation
                          ? ` • ${item.participation.attendanceStatus}`
                          : ' • Chưa có ghi nhận tham gia'}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>


          <TouchGroup
            label="7. Hướng theo dõi *"
            options={FOLLOW_UP_OPTIONS}
            value={followUpStatus}
            onChange={setFollowUpStatus}
          />


          <button
            type="button"
            onClick={() =>
              setShowDetails(
                (value) => !value,
              )
            }
            style={{
              width: '100%',
              minHeight: '42px',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            {showDetails
              ? 'Thu gọn nội dung bổ sung'
              : 'Thêm can thiệp / ghi chú nếu cần'}
          </button>


          {showDetails && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '13px',
                padding: '13px',
                background: '#fafafa',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#334155',
                }}
              >
                <input
                  type="checkbox"
                  checked={noteworthyBehavior}
                  onChange={(event) =>
                    setNoteworthyBehavior(
                      event.target.checked,
                    )
                  }
                />

                Có hành vi đáng chú ý
              </label>

              {noteworthyBehavior && (
                <textarea
                  value={noteworthyBehaviorNote}
                  onChange={(event) =>
                    setNoteworthyBehaviorNote(
                      event.target.value,
                    )
                  }
                  placeholder="Mô tả điều quan sát được..."
                  rows={2}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    padding: '10px',
                    fontSize: '12px',
                  }}
                />
              )}


              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#334155',
                    marginBottom: '7px',
                  }}
                >
                  Can thiệp / hỗ trợ đã thực hiện
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '7px',
                  }}
                >
                  {INTERVENTION_OPTIONS.map(
                    (option) => {
                      const selected =
                        interventions.includes(
                          option.value,
                        );

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            toggleIntervention(
                              option.value,
                            )
                          }
                          style={{
                            padding: '8px 10px',
                            borderRadius: '13px',
                            border:
                              selected
                                ? '2px solid #7c3aed'
                                : '1px solid #cbd5e1',
                            background:
                              selected
                                ? '#ede9fe'
                                : '#ffffff',
                            color:
                              selected
                                ? '#6d28d9'
                                : '#475569',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>


              {followUpStatus ===
                'COORDINATED' && (
                <>
                  <input
                    value={coordinationDestination}
                    onChange={(event) =>
                      setCoordinationDestination(
                        event.target.value,
                      )
                    }
                    placeholder="Bộ phận / người cần phối hợp"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: '40px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '0 10px',
                      fontSize: '12px',
                    }}
                  />

                  <textarea
                    value={coordinationReason}
                    onChange={(event) =>
                      setCoordinationReason(
                        event.target.value,
                      )
                    }
                    placeholder="Lý do cần phối hợp..."
                    rows={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      padding: '10px',
                      fontSize: '12px',
                    }}
                  />
                </>
              )}


              <textarea
                value={notableEventNote}
                onChange={(event) =>
                  setNotableEventNote(
                    event.target.value,
                  )
                }
                placeholder="Sự kiện đáng chú ý khác (nếu có)"
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  padding: '10px',
                  fontSize: '12px',
                }}
              />

              <textarea
                value={professionalNote}
                onChange={(event) =>
                  setProfessionalNote(
                    event.target.value,
                  )
                }
                placeholder="Ghi chú chuyên môn Tâm lý–CTXH (nếu cần)"
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  padding: '10px',
                  fontSize: '12px',
                }}
              />
            </div>
          )}


          {error && (
            <div
              style={{
                padding: '11px',
                borderRadius: '13px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}


          {success && (
            <div
              style={{
                padding: '11px',
                borderRadius: '13px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              ✓ {success}
            </div>
          )}


          <button
            type="button"
            disabled={
              submitting ||
              !selectedResidentId
            }
            onClick={() => {
              void save();
            }}
            style={{
              width: '100%',
              minHeight: '48px',
              borderRadius: '16px',
              border: 0,
              background:
                submitting ||
                !selectedResidentId
                  ? '#94a3b8'
                  : '#0f766e',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 900,
              cursor:
                submitting
                  ? 'wait'
                  : 'pointer',
            }}
          >
            {submitting
              ? 'Đang lưu...'
              : '✓ Lưu ghi nhận hôm nay'}
          </button>
        </>
      )}
    </div>
  );
}
