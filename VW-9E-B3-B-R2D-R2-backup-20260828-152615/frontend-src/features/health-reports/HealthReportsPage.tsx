import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  approveHealthReport,
  createHealthReport,
  downloadHealthReportPdf,
  generateHealthReport,
  listHealthReports,
  startHealthReportReview,
  type HealthReportActor,
  type HealthReportRow,
} from './healthReportsApi';

const STATUS:
  Record<string, string> = {
    DRAFT: 'Bản nháp',
    GENERATED: 'Đã khóa dữ liệu',
    UNDER_REVIEW: 'Đang rà soát',
    REVISION_REQUIRED:
      'Yêu cầu chỉnh sửa',
    APPROVED: 'Đã phê duyệt',
    DELIVERED: 'Đã gửi',
    SUPERSEDED: 'Đã thay thế',
    CANCELLED: 'Đã hủy',
  };

const TYPE:
  Record<string, string> = {
    WEEKLY: 'Hàng tuần',
    MONTHLY: 'Hàng tháng',
    QUARTERLY: 'Hàng quý',
    CUSTOM: 'Theo kỳ tùy chọn',
    EVENT_BASED: 'Theo sự kiện',
  };

function currentActor():
  HealthReportActor | null {
  const candidates = [
    'tamancare_actor',
    'humanActor',
    'actor',
  ];

  for (const key of candidates) {
    const raw =
      window.localStorage.getItem(
        key,
      );

    if (!raw) {
      continue;
    }

    try {
      const value =
        JSON.parse(raw) as
          Record<string, unknown>;

      const actorId =
        String(
          value.actorId ??
          value.actor_id ??
          '',
        );

      const actorRole =
        String(
          value.actorRole ??
          value.actor_role ??
          value.role ??
          '',
        );

      if (
        actorId &&
        actorRole
      ) {
        return {
          actorId,
          actorRole,
        };
      }
    } catch {
      // Continue to next known key.
    }
  }

  const actorId =
    window.localStorage.getItem(
      'actorId',
    );

  const actorRole =
    window.localStorage.getItem(
      'actorRole',
    );

  if (
    actorId &&
    actorRole
  ) {
    return {
      actorId,
      actorRole,
    };
  }

  return null;
}

export function HealthReportsPage() {
  const [actor] =
    useState<HealthReportActor | null>(
      () => currentActor(),
    );

  const [reports, setReports] =
    useState<HealthReportRow[]>([]);

  const [residentId, setResidentId] =
    useState('');

  const [periodStart, setPeriodStart] =
    useState('');

  const [periodEnd, setPeriodEnd] =
    useState('');

  const [summary, setSummary] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const refresh =
    useCallback(async () => {
      if (!actor) {
        return;
      }

      try {
        const rows =
          await listHealthReports(
            actor,
          );

        setReports(rows);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Không tải được danh sách báo cáo.',
        );
      }
    }, [actor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function execute(
    action: () => Promise<unknown>,
    success: string,
  ) {
    try {
      setBusy(true);
      setMessage('');

      await action();
      await refresh();

      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Có lỗi xảy ra.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!actor) {
      setMessage(
        'Chưa xác định được người dùng vận hành.',
      );
      return;
    }

    if (
      !residentId ||
      !periodStart ||
      !periodEnd
    ) {
      setMessage(
        'Vui lòng nhập đầy đủ mã người cao tuổi và kỳ báo cáo.',
      );
      return;
    }

    await execute(
      () =>
        createHealthReport(
          actor,
          {
            residentId,
            reportType: 'CUSTOM',
            periodStart:
              `${periodStart}T00:00:00.000Z`,
            periodEnd:
              `${periodEnd}T23:59:59.999Z`,
            summary:
              summary || undefined,
          },
        ),
      'Đã tạo bản nháp báo cáo.',
    );
  }

  async function pdf(
    report: HealthReportRow,
  ) {
    if (!actor) {
      return;
    }

    try {
      setBusy(true);

      const blob =
        await downloadHealthReportPdf(
          actor,
          report.health_report_id,
        );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement('a');

      a.href = url;

      a.download =
        `bao-cao-suc-khoe-${report.health_report_id}.pdf`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);

      setMessage(
        'Đã tạo PDF từ snapshot dữ liệu đã khóa.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Không thể tạo PDF.',
      );
    } finally {
      setBusy(false);
    }
  }

  const canApprove =
    actor?.actorRole ===
      'CARE_MANAGER' ||
    actor?.actorRole ===
      'SUPERVISOR';

  if (!actor) {
    return (
      <main>
        <h1>
          Báo cáo sức khỏe định kỳ
        </h1>

        <p>
          Chưa có phiên người dùng vận hành.
          Vui lòng đăng nhập hoặc chọn nhân sự
          trước khi sử dụng chức năng này.
        </p>
      </main>
    );
  }

  return (
    <main>
      <section>
        <h1>
          Báo cáo sức khỏe định kỳ
        </h1>

        <p>
          Lập báo cáo từ dữ liệu chăm sóc
          đã được khóa theo kỳ, thực hiện
          rà soát, phê duyệt và tạo PDF
          để cung cấp cho gia đình hoặc
          người đại diện được ủy quyền.
        </p>
      </section>

      {message ? (
        <section>
          <p>{message}</p>
        </section>
      ) : null}

      <section>
        <h2>
          Tạo kỳ báo cáo
        </h2>

        <div>
          <label>
            Mã người cao tuổi
            <input
              value={residentId}
              onChange={(event) =>
                setResidentId(
                  event.target.value,
                )
              }
              placeholder="resident-..."
            />
          </label>

          <label>
            Từ ngày
            <input
              type="date"
              value={periodStart}
              onChange={(event) =>
                setPeriodStart(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            Đến ngày
            <input
              type="date"
              value={periodEnd}
              onChange={(event) =>
                setPeriodEnd(
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label>
          Tóm tắt
          <textarea
            value={summary}
            onChange={(event) =>
              setSummary(
                event.target.value,
              )
            }
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void create()
          }
        >
          Tạo báo cáo
        </button>
      </section>

      <section>
        <h2>
          Danh sách báo cáo
        </h2>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void refresh()
          }
        >
          Làm mới
        </button>

        {reports.length === 0 ? (
          <p>
            Chưa có báo cáo sức khỏe.
          </p>
        ) : (
          <div
            style={{
              overflowX: 'auto',
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Người cao tuổi
                  </th>
                  <th>
                    Loại
                  </th>
                  <th>
                    Kỳ báo cáo
                  </th>
                  <th>
                    Trạng thái
                  </th>
                  <th>
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {reports.map(
                  (report) => (
                    <tr
                      key={
                        report.health_report_id
                      }
                    >
                      <td>
                        {
                          report.resident_id
                        }
                      </td>

                      <td>
                        {
                          TYPE[
                            report.report_type
                          ] ??
                          report.report_type
                        }
                      </td>

                      <td>
                        {new Date(
                          report.period_start,
                        ).toLocaleDateString(
                          'vi-VN',
                        )}
                        {' – '}
                        {new Date(
                          report.period_end,
                        ).toLocaleDateString(
                          'vi-VN',
                        )}
                      </td>

                      <td>
                        {
                          STATUS[
                            report.status
                          ] ??
                          report.status
                        }
                      </td>

                      <td>
                        {report.status ===
                        'DRAFT' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void execute(
                                () =>
                                  generateHealthReport(
                                    actor,
                                    report.health_report_id,
                                  ),
                                'Đã tạo snapshot và khóa dữ liệu kỳ báo cáo.',
                              )
                            }
                          >
                            Khóa dữ liệu
                          </button>
                        ) : null}

                        {report.status ===
                        'GENERATED' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void execute(
                                () =>
                                  startHealthReportReview(
                                    actor,
                                    report.health_report_id,
                                  ),
                                'Đã chuyển báo cáo sang rà soát.',
                              )
                            }
                          >
                            Rà soát
                          </button>
                        ) : null}

                        {report.status ===
                          'UNDER_REVIEW' &&
                        canApprove ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void execute(
                                () =>
                                  approveHealthReport(
                                    actor,
                                    report.health_report_id,
                                  ),
                                'Đã phê duyệt báo cáo.',
                              )
                            }
                          >
                            Phê duyệt
                          </button>
                        ) : null}

                        {report.status ===
                          'APPROVED' ||
                        report.status ===
                          'DELIVERED' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void pdf(report)
                            }
                          >
                            Tải PDF
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default HealthReportsPage;
