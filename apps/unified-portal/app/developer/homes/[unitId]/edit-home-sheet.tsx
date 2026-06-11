'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Loader2, Check } from 'lucide-react';

export interface EditableHome {
  unitId: string;
  address: string;
  house_type_code: string;
  bedrooms: number | null;
  eircode: string;
  phase: string;
  property_designation: string;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string;
  sale_price: number | null;
  solicitor_firm: string;
  solicitor_name: string;
  solicitor_email: string;
  solicitor_phone: string;
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-grey-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-grey-200 bg-white px-3.5 py-2.5 text-sm text-grey-900 outline-none placeholder:text-grey-300 focus:border-gold-400"
      />
    </label>
  );
}

export function EditHomeSheet({ home }: { home: EditableHome }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    address: home.address,
    house_type_code: home.house_type_code,
    bedrooms: home.bedrooms === null ? '' : String(home.bedrooms),
    eircode: home.eircode,
    phase: home.phase,
    property_designation: home.property_designation,
    purchaser_name: home.purchaser_name,
    purchaser_email: home.purchaser_email,
    purchaser_phone: home.purchaser_phone,
    sale_price: home.sale_price === null ? '' : String(home.sale_price),
    solicitor_firm: home.solicitor_firm,
    solicitor_name: home.solicitor_name,
    solicitor_email: home.solicitor_email,
    solicitor_phone: home.solicitor_phone,
  });

  const set = (key: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/developer/homes/${home.unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address,
          house_type_code: form.house_type_code,
          bedrooms: form.bedrooms.trim() === '' ? '' : Number(form.bedrooms),
          eircode: form.eircode,
          phase: form.phase,
          property_designation: form.property_designation,
          purchaser_name: form.purchaser_name,
          purchaser_email: form.purchaser_email,
          purchaser_phone: form.purchaser_phone,
          sale_price: form.sale_price.trim() === '' ? '' : Number(form.sale_price.replace(/[€,\s]/g, '')),
          solicitor_firm: form.solicitor_firm,
          solicitor_name: form.solicitor_name,
          solicitor_email: form.solicitor_email,
          solicitor_phone: form.solicitor_phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save changes.');
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-grey-200 bg-white px-4 py-2.5 text-sm font-semibold text-grey-600 transition-all hover:border-gold-400 hover:text-gold-700"
      >
        <Pencil className="h-4 w-4" /> Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => !saving && setOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-grey-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-grey-900">Edit home</h2>
                <p className="text-xs text-grey-400">Dates live in the pipeline panel</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-grey-400 hover:bg-grey-50 hover:text-grey-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={save} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-grey-400">Home</h3>
                  <Field label="Address" value={form.address} onChange={set('address')} placeholder="12 The Green" />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="House type" value={form.house_type_code} onChange={set('house_type_code')} placeholder="BD01" />
                    <Field label="Bedrooms" value={form.bedrooms} onChange={set('bedrooms')} type="number" />
                    <Field label="Eircode" value={form.eircode} onChange={set('eircode')} placeholder="A65 F4E2" />
                    <Field label="Phase" value={form.phase} onChange={set('phase')} />
                  </div>
                  <Field label="Designation" value={form.property_designation} onChange={set('property_designation')} placeholder="D / SD / T" />
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-grey-400">Purchaser</h3>
                  <Field label="Name" value={form.purchaser_name} onChange={set('purchaser_name')} placeholder="Leave blank if for sale" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Email" value={form.purchaser_email} onChange={set('purchaser_email')} type="email" />
                    <Field label="Phone" value={form.purchaser_phone} onChange={set('purchaser_phone')} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-grey-400">Sale</h3>
                  <Field label="Price (€)" value={form.sale_price} onChange={set('sale_price')} placeholder="385000" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Solicitor firm" value={form.solicitor_firm} onChange={set('solicitor_firm')} />
                    <Field label="Solicitor name" value={form.solicitor_name} onChange={set('solicitor_name')} />
                    <Field label="Solicitor email" value={form.solicitor_email} onChange={set('solicitor_email')} type="email" />
                    <Field label="Solicitor phone" value={form.solicitor_phone} onChange={set('solicitor_phone')} />
                  </div>
                </section>
              </div>

              <div className="border-t border-grey-100 px-6 py-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-gold-600 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
