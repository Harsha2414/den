"use client";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "url" | "date" | "time" | "datetime-local";
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  initial?: string;
  hint?: string;
  max?: number;
};

export default function Field({ f, id, value, onChange }: { f: FieldDef; id: string; value: string; onChange: (v: string) => void }) {
  const common = { id, value, onChange: (e: { target: { value: string } }) => onChange(e.target.value) };
  return (
    <div className="field">
      <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
      {f.type === "textarea" ? (
        <textarea {...common} placeholder={f.placeholder} maxLength={f.max} />
      ) : f.type === "select" ? (
        <select {...common}>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>
      ) : (
        <input {...common} type={f.type} placeholder={f.placeholder} maxLength={f.max}
          {...(f.type === "number" ? { min: 0, inputMode: "numeric" as const } : {})} />
      )}
      {f.hint && <small>{f.hint}</small>}
    </div>
  );
}
