'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface House {
  id: string;
  development_id: string;
  unit_number: string;
  unit_uid: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  house_type_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  purchase_date: string | null;
  move_in_date: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function HouseEditPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.id as string;
  const houseId = params.houseId as string;

  const [house, setHouse] = useState<House | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHouse();
  }, [houseId]);

  const fetchHouse = async () => {
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        const foundHouse = data.houses.find((h: House) => h.id === houseId);
        if (foundHouse) {
          setHouse(foundHouse);
        } else {
          toast.error('House not found');
          router.push(`/developments/${developmentId}`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch house:', error);
      toast.error('Failed to load house details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!house) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/houses/${houseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(house),
      });

      if (response.ok) {
        toast.success('House updated successfully');
        router.push(`/developments/${developmentId}`);
      } else {
        toast.error('Failed to update house');
      }
    } catch (error) {
      console.error('Failed to update house:', error);
      toast.error('Failed to update house');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof House, value: string | number | null) => {
    if (!house) return;
    setHouse({ ...house, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-grey-500">Loading...</div>
      </div>
    );
  }

  if (!house) {
    return null;
  }

  return (
    <div className="min-h-screen bg-grey-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href={`/developments/${developmentId}`}
            className="text-gold-600 hover:text-gold-700 text-sm font-medium flex items-center gap-2"
          >
            ← Back to Development
          </Link>
        </div>

        <div className="bg-white rounded-premium shadow-card p-8">
          <h1 className="text-2xl font-bold text-black mb-6">
            Edit Unit {house.unit_number}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  Unit Number
                </label>
                <input
                  type="text"
                  value={house.unit_number}
                  onChange={(e) => handleChange('unit_number', e.target.value)}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  Unit UID
                </label>
                <input
                  type="text"
                  value={house.unit_uid}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium bg-grey-100"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  House Type Code
                </label>
                <input
                  type="text"
                  value={house.house_type_code || ''}
                  onChange={(e) => handleChange('house_type_code', e.target.value || null)}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  Bedrooms
                </label>
                <input
                  type="number"
                  value={house.bedrooms || ''}
                  onChange={(e) => handleChange('bedrooms', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  Bathrooms
                </label>
                <input
                  type="number"
                  value={house.bathrooms || ''}
                  onChange={(e) => handleChange('bathrooms', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-grey-700 mb-2">
                  Square Footage
                </label>
                <input
                  type="number"
                  value={house.square_footage || ''}
                  onChange={(e) => handleChange('square_footage', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border-t border-grey-200 pt-6 mt-6">
              <h2 className="text-lg font-semibold text-black mb-4">Address Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={house.address_line_1 || ''}
                    onChange={(e) => handleChange('address_line_1', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={house.address_line_2 || ''}
                    onChange={(e) => handleChange('address_line_2', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={house.city || ''}
                    onChange={(e) => handleChange('city', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={house.state_province || ''}
                    onChange={(e) => handleChange('state_province', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={house.postal_code || ''}
                    onChange={(e) => handleChange('postal_code', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={house.country || ''}
                    onChange={(e) => handleChange('country', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-grey-200 pt-6 mt-6">
              <h2 className="text-lg font-semibold text-black mb-4">Purchaser Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Purchaser Name
                  </label>
                  <input
                    type="text"
                    value={house.purchaser_name || ''}
                    onChange={(e) => handleChange('purchaser_name', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Purchaser Email
                  </label>
                  <input
                    type="email"
                    value={house.purchaser_email || ''}
                    onChange={(e) => handleChange('purchaser_email', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Purchaser Phone
                  </label>
                  <input
                    type="tel"
                    value={house.purchaser_phone || ''}
                    onChange={(e) => handleChange('purchaser_phone', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={house.purchase_date || ''}
                    onChange={(e) => handleChange('purchase_date', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-grey-700 mb-2">
                    Move-in Date
                  </label>
                  <input
                    type="date"
                    value={house.move_in_date || ''}
                    onChange={(e) => handleChange('move_in_date', e.target.value || null)}
                    className="w-full px-4 py-2 border border-grey-300 rounded-premium focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-grey-200">
              <Link
                href={`/developments/${developmentId}`}
                className="px-6 py-2.5 border border-grey-300 text-grey-700 rounded-premium hover:bg-grey-50 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow transition-all duration-premium font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
