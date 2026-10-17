interface MessageProps {
  title: string;
  description?: string;
}

export function LoadingState({
  title,
  description,
}: MessageProps) {
  return (
    <div
      className="feedback-state"
      role="status"
    >
      <div className="feedback-spinner" />
      <strong>{title}</strong>

      {description && (
        <span>{description}</span>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: MessageProps) {
  return (
    <div className="feedback-state">
      <div
        className="feedback-symbol"
        aria-hidden="true"
      >
        ○
      </div>

      <strong>{title}</strong>

      {description && (
        <span>{description}</span>
      )}
    </div>
  );
}

export function ErrorState({
  title,
  description,
}: MessageProps) {
  return (
    <div
      className="feedback-state feedback-error"
      role="alert"
    >
      <div
        className="feedback-symbol"
        aria-hidden="true"
      >
        !
      </div>

      <strong>{title}</strong>

      {description && (
        <span>{description}</span>
      )}
    </div>
  );
}
