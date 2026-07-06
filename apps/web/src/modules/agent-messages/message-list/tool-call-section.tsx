export function ToolCallSection({
  danger,
  title,
  value
}: {
  danger?: boolean;
  title: string;
  value: string;
}) {
  return (
    <section className="agent-tool-call__section">
      <div className="agent-tool-call__section-title">{title}</div>
      <pre
        className={
          danger
            ? "agent-tool-call__content agent-tool-call__content--danger"
            : "agent-tool-call__content"
        }
      >
        {value || "(empty)"}
      </pre>
    </section>
  );
}
