import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Plus, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import type { GenderOption } from '../types';
import { validateDisplayName } from '../utils/validators';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, loading, saving, error, refresh, updateProfile } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<GenderOption | ''>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState('');

  const [nameError, setNameError] = useState<string | undefined>();
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || user?.display_name || '');
      setDateOfBirth(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : '');
      setGender(profile.gender || '');
      setConditions(profile.medical_conditions ?? []);
      setAllergies(profile.allergies ?? []);
    } else if (user) {
      setDisplayName(user.display_name || '');
    }
  }, [profile, user]);

  const handleAddCondition = () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (!conditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setConditions((prev) => [...prev, trimmed]);
    }
    setNewCondition('');
  };

  const handleRemoveCondition = (item: string) => {
    setConditions((prev) => prev.filter((c) => c !== item));
  };

  const handleAddAllergy = () => {
    const trimmed = newAllergy.trim();
    if (!trimmed) return;
    if (!allergies.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setAllergies((prev) => [...prev, trimmed]);
    }
    setNewAllergy('');
  };

  const handleRemoveAllergy = (item: string) => {
    setAllergies((prev) => prev.filter((a) => a !== item));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveSuccess(false);

    const check = validateDisplayName(displayName);
    if (!check.valid) {
      setNameError(check.error);
      return;
    }
    setNameError(undefined);

    const updated = await updateProfile({
      display_name: displayName.trim(),
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      medical_conditions: conditions,
      allergies,
    });

    if (updated) {
      setSaveSuccess(true);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading your health profile..." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Health Profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Keep your basic demographics, medical conditions, and allergies up to date
          for more relevant AI health guidance.
        </p>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => void refresh()} />}

      {saveSuccess && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          Your profile has been saved successfully.
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
        {/* Personal Information */}
        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="profile-name"
              label="Display Name"
              required
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (nameError) setNameError(undefined);
                setSaveSuccess(false);
              }}
              error={nameError}
            />

            <Input
              id="profile-email"
              label="Email Address"
              type="email"
              value={user?.email || ''}
              disabled
              helperText="Email address cannot be changed here."
            />

            <Input
              id="profile-dob"
              label="Date of Birth"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                setSaveSuccess(false);
              }}
            />

            <div>
              <label
                htmlFor="profile-gender"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Gender
              </label>
              <select
                id="profile-gender"
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value as GenderOption | '');
                  setSaveSuccess(false);
                }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Medical Conditions */}
        <Card>
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Medical Conditions
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Add chronic or ongoing medical conditions (e.g., Hypertension, Type 2
            Diabetes, Asthma).
          </p>

          <div className="flex gap-2">
            <Input
              id="new-condition"
              placeholder="Enter a medical condition"
              aria-label="New medical condition"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCondition();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCondition}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>

          {conditions.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">
              No medical conditions listed.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2" role="list">
              {conditions.map((condition) => (
                <li
                  key={condition}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"
                >
                  <span>{condition}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(condition)}
                    aria-label={`Remove ${condition}`}
                    className="rounded-full p-0.5 hover:bg-blue-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Allergies */}
        <Card>
          <h2 className="mb-1 text-base font-semibold text-gray-900">Allergies</h2>
          <p className="mb-4 text-xs text-gray-500">
            List medication, food, or environmental allergies (e.g., Penicillin,
            Peanuts, Pollen).
          </p>

          <div className="flex gap-2">
            <Input
              id="new-allergy"
              placeholder="Enter an allergy"
              aria-label="New allergy"
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAllergy();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAllergy}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>

          {allergies.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">No allergies listed.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2" role="list">
              {allergies.map((allergy) => (
                <li
                  key={allergy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                >
                  <span>{allergy}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAllergy(allergy)}
                    aria-label={`Remove ${allergy}`}
                    className="rounded-full p-0.5 hover:bg-amber-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={saving}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
