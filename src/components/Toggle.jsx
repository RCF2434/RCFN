export default function Toggle({ checked, onChange, children }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__knob" />
      </span>
      <span className="toggle__label">{children}</span>
    </label>
  );
}
