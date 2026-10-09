import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { apiRequest } from '../../api/client';
import type { HumanActorSession } from '../../types/actor';

type PaperRecordStatus =
  | 'STORED'
  | 'BORROWED'
  | 'RETURNED_TO_FAMILY'
  | 'ARCHIVED';

type DocumentItem = {
  name: string;
  present: boolean;
  note?: string | null;
};

type PaperRecord = {
  paperRecordId: string;
  residentId: string;
  recordCode: string;
  cabinet: string | null;
  drawer: string | null;
  position: string | null;
  status: PaperRecordStatus;
  currentBorrowerActorId: string | null;
  currentBorrowerName: string | null;
  borrowedAt: string | null;
  returnedAt: string | null;
  documentCatalog: DocumentItem[];
  lastInventoryAt: string | null;
  qrToken: string;
  qrPath: string;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  recordCode: string;
  cabinet: string;
  drawer: string;
  position: string;
  status: 'STORED' | 'RETURNED_TO_FAMILY' | 'ARCHIVED';
  documentText: string;
  lastInventoryAt: string;
};

const EMPTY_FORM: FormState = {
  recordCode: '',
  cabinet: '',
  drawer: '',
  position: '',
  status: 'STORED',
  documentText: '',
  lastInventoryAt: '',
};

const STATUS_LABEL: Record<PaperRecordStatus, string> = {
  STORED: 'Đang lưu tại tủ',
  BORROWED: 'Đang được mượn',
  RETURNED_TO_FAMILY: 'Đã trả gia đình',
  ARCHIVED: 'Lưu trữ đóng',
};

const MANAGER_ROLES = new Set([
  'ADMIN',
  'SUPERVISOR',
  'CARE_MANAGER',
  'RECEPTIONIST',
  'DIRECTOR',
]);

const BORROW_ROLES = new Set([
  'ADMIN',
  'SUPERVISOR',
  'CARE_MANAGER',
  'RECEPTIONIST',
  'DIRECTOR',
  'NURSE',
  'CAREGIVER',
]);

function toForm(record: PaperRecord | null): FormState {
  if (!record) return { ...EMPTY_FORM };

  return {
    recordCode: record.recordCode ?? '',
    cabinet: record.cabinet ?? '',
    drawer: record.drawer ?? '',
    position: record.position ?? '',
    status:
      record.status === 'RETURNED_TO_FAMILY'
      || record.status === 'ARCHIVED'
        ? record.status
        : 'STORED',
    documentText: (record.documentCatalog ?? [])
      .filter((item) => item.present !== false)
      .map((item) => item.name)
      .join('\n'),
    lastInventoryAt: record.lastInventoryAt
      ? String(record.lastInventoryAt).slice(0, 10)
      : '',
  };
}

export function PaperRecordCard({
  residentId,
  actor,
}: {
  residentId: string;
  actor: HumanActorSession;
}) {
  const [record, setRecord] = useState<PaperRecord | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const role = String(actor.actorRole ?? '').toUpperCase();
  const canManage = MANAGER_ROLES.has(role);
  const canBorrow = BORROW_ROLES.has(role);

  const load = async () => {
    if (!residentId) return;
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<PaperRecord | null>(
        '/api/paper-records/' + encodeURIComponent(residentId),
        { actor },
      );
      setRecord(result);
      setForm(toForm(result));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tải được thông tin hồ sơ giấy.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [
    residentId,
    actor.actorId,
    actor.actorRole,
  ]);

  const statusText = useMemo(
    () => record ? STATUS_LABEL[record.status] : 'Chưa thiết lập',
    [record],
  );

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const save = async () => {
    if (!form.recordCode.trim()) {
      setError('Vui lòng nhập Mã hồ sơ giấy.');
      return;
    }

    setWorking(true);
    setError('');

    try {
      const documentCatalog = form.documentText
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          present: true,
        }));

      const result = await apiRequest<PaperRecord>(
        '/api/paper-records/' + encodeURIComponent(residentId),
        {
          method: 'PUT',
          actor,
          body: JSON.stringify({
            recordCode: form.recordCode.trim(),
            cabinet: form.cabinet.trim() || null,
            drawer: form.drawer.trim() || null,
            position: form.position.trim() || null,
            status: form.status,
            documentCatalog,
            lastInventoryAt: form.lastInventoryAt || null,
          }),
        },
      );

      setRecord(result);
      setForm(toForm(result));
      setEditing(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không lưu được hồ sơ giấy.',
      );
    } finally {
      setWorking(false);
    }
  };

  const changeLoanState = async (action: 'borrow' | 'return') => {
    setWorking(true);
    setError('');

    try {
      const result = await apiRequest<PaperRecord>(
        '/api/paper-records/'
          + encodeURIComponent(residentId)
          + '/'
          + action,
        {
          method: 'POST',
          actor,
        },
      );

      setRecord(result);
      setForm(toForm(result));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không cập nhật được trạng thái mượn/trả.',
      );
    } finally {
      setWorking(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.48rem 0.58rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.375rem',
    fontSize: '0.84rem',
    background: '#ffffff',
  } as const;

  return (
    <section
      id="paper-record"
      className="card"
      style={{
        background: '#ffffff',
        border: '1px solid #dbe5dc',
        borderRadius: '0.75rem',
        padding: '1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          marginBottom: '0.85rem',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#166534',
            }}
          >
            📁 Hồ sơ giấy
          </h3>
          <div
            style={{
              marginTop: '0.25rem',
              fontSize: '0.78rem',
              color: '#64748b',
            }}
          >
            {(record?.recordCode || 'Chưa có mã hồ sơ') + ' · ' + statusText}
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            className="btn btn-secondary no-print"
            disabled={working}
            onClick={() => {
              setEditing((value) => !value);
              setForm(toForm(record));
              setError('');
            }}
            style={{ fontSize: '0.8rem' }}
          >
            {editing ? 'Đóng' : record ? 'Cập nhật' : 'Thiết lập'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
          Đang tải hồ sơ giấy…
        </div>
      ) : (
        <>
          {error && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: '0.4rem',
                background: '#fff1f2',
                color: '#9f1239',
                fontSize: '0.82rem',
              }}
            >
              {error}
            </div>
          )}

          {!record && !editing && (
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Chưa khai báo vị trí lưu hồ sơ giấy cho cụ này.
            </div>
          )}

          {record && !editing && (
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: '125px 1fr',
                rowGap: '0.55rem',
                margin: 0,
                fontSize: '0.84rem',
              }}
            >
              <dt style={{ color: '#64748b' }}>Mã hồ sơ:</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}>{record.recordCode}</dd>

              <dt style={{ color: '#64748b' }}>Vị trí:</dt>
              <dd style={{ margin: 0 }}>
                {[record.cabinet, record.drawer, record.position]
                  .filter(Boolean)
                  .join(' · ') || 'Chưa xác định'}
              </dd>

              <dt style={{ color: '#64748b' }}>Trạng thái:</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>
                {STATUS_LABEL[record.status]}
              </dd>

              <dt style={{ color: '#64748b' }}>Người đang mượn:</dt>
              <dd style={{ margin: 0 }}>
                {record.currentBorrowerName || '—'}
              </dd>

              <dt style={{ color: '#64748b' }}>Mượn / trả:</dt>
              <dd style={{ margin: 0 }}>
                {record.borrowedAt
                  ? new Date(record.borrowedAt).toLocaleString('vi-VN')
                  : '—'}
                {record.returnedAt
                  ? ' / ' + new Date(record.returnedAt).toLocaleString('vi-VN')
                  : ''}
              </dd>

              <dt style={{ color: '#64748b' }}>Tài liệu:</dt>
              <dd style={{ margin: 0 }}>
                {(record.documentCatalog ?? []).length > 0
                  ? record.documentCatalog
                      .filter((item) => item.present !== false)
                      .map((item) => item.name)
                      .join(', ')
                  : 'Chưa lập danh mục'}
              </dd>

              <dt style={{ color: '#64748b' }}>Kiểm kê gần nhất:</dt>
              <dd style={{ margin: 0 }}>
                {record.lastInventoryAt
                  ? new Date(record.lastInventoryAt).toLocaleDateString('vi-VN')
                  : '—'}
              </dd>
            </dl>
          )}

          {editing && canManage && (
            <div
              className="no-print"
              style={{
                display: 'grid',
                gap: '0.7rem',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.65rem',
                }}
              >
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Mã hồ sơ *
                  <input
                    value={form.recordCode}
                    onChange={(event) => updateField('recordCode', event.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Tủ
                  <input
                    value={form.cabinet}
                    onChange={(event) => updateField('cabinet', event.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Ngăn
                  <input
                    value={form.drawer}
                    onChange={(event) => updateField('drawer', event.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Vị trí
                  <input
                    value={form.position}
                    onChange={(event) => updateField('position', event.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Trạng thái
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        'status',
                        event.target.value as FormState['status'],
                      )
                    }
                    style={inputStyle}
                    disabled={record?.status === 'BORROWED'}
                  >
                    <option value="STORED">Đang lưu tại tủ</option>
                    <option value="RETURNED_TO_FAMILY">Đã trả gia đình</option>
                    <option value="ARCHIVED">Lưu trữ đóng</option>
                  </select>
                </label>

                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                  Ngày kiểm kê gần nhất
                  <input
                    type="date"
                    value={form.lastInventoryAt}
                    onChange={(event) =>
                      updateField('lastInventoryAt', event.target.value)
                    }
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                Danh mục tài liệu
                <textarea
                  rows={5}
                  value={form.documentText}
                  onChange={(event) => updateField('documentText', event.target.value)}
                  placeholder="Mỗi tài liệu một dòng"
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                  }}
                />
              </label>

              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={working}
                  onClick={() => void save()}
                >
                  {working ? 'Đang lưu…' : 'Lưu hồ sơ giấy'}
                </button>
              </div>
            </div>
          )}

          {record && !editing && canBorrow && (
            <div
              className="no-print"
              style={{
                display: 'flex',
                gap: '0.55rem',
                marginTop: '0.9rem',
                flexWrap: 'wrap',
              }}
            >
              {record.status === 'STORED' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={working}
                  onClick={() => void changeLoanState('borrow')}
                >
                  📤 Mượn hồ sơ
                </button>
              )}

              {record.status === 'BORROWED' && (
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={working}
                  onClick={() => void changeLoanState('return')}
                >
                  📥 Trả hồ sơ
                </button>
              )}
            </div>
          )}

          {record?.qrPath && (
            <div
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid #f1f5f9',
                color: '#64748b',
                fontSize: '0.72rem',
              }}
            >
              QR-ready · Mã QR sau này sẽ mở đúng mục Hồ sơ giấy sau khi xác thực quyền.
            </div>
          )}
        </>
      )}
    </section>
  );
}
