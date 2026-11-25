/**
 * design.md 的門票撕線：以陰影壓印的短線段，延伸到容器左右兩側。
 * 父層以 --tear-inset 指定自己的左右內距。
 */
export default function TicketTear() {
  return (
    <div className="ticket-tear" role="separator">
      <span className="ticket-tear__perf" />
    </div>
  );
}
