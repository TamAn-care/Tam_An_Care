import {
  useState,
} from 'react';

import {
  useActor,
} from './ActorContext';

import type {
  HumanActorRole,
} from '../types/actor';

export function DevelopmentActorPanel() {
  const {
    actor,
    setActor,
    clearActor,
  } = useActor();

  const [actorId, setActorId] =
    useState(
      actor?.actorId ?? '',
    );

  const [actorRole, setActorRole] =
    useState<HumanActorRole>(
      actor?.actorRole ??
        'SUPERVISOR',
    );

  return (
    <div className="card">
      <div className="development-badge">
        DEVELOPMENT ONLY
      </div>

      <h2>
        Ngữ cảnh nhân sự thử nghiệm
      </h2>

      <p className="helper">
        Cơ chế này chỉ phục vụ giai đoạn
        phát triển V7.5. Backend vẫn là
        nguồn quyết định quyền truy cập.
      </p>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="actor-id">
            Actor ID
          </label>

          <input
            id="actor-id"
            value={actorId}
            onChange={(event) =>
              setActorId(
                event.target.value,
              )
            }
            placeholder="actor-id"
          />
        </div>

        <div className="form-field">
          <label htmlFor="actor-role">
            Vai trò
          </label>

          <select
            id="actor-role"
            value={actorRole}
            onChange={(event) =>
              setActorRole(
                event.target.value
                  as HumanActorRole,
              )
            }
          >
            <option value="CAREGIVER">
              Nhân viên chăm sóc
            </option>

            <option value="NURSE">
              Điều dưỡng
            </option>

            <option value="SUPERVISOR">
              Giám sát
            </option>
          </select>
        </div>

        <div>
          <button
            className="button button-primary"
            type="button"
            disabled={
              actorId.trim().length === 0
            }
            onClick={() =>
              setActor({
                actorId:
                  actorId.trim(),
                actorRole,
              })
            }
          >
            Áp dụng ngữ cảnh
          </button>

          {' '}

          <button
            className="button"
            type="button"
            onClick={() => {
              clearActor();
              setActorId('');
            }}
          >
            Xóa ngữ cảnh
          </button>
        </div>
      </div>
    </div>
  );
}
