import { useState, type FormEvent } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { HealthRecordCreate } from '../../types';

interface QuickVitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: HealthRecordCreate) => Promise<boolean>;
  saving: boolean;
}

export function QuickVitalsModal({
  isOpen,
  onClose,
  onSave,
  saving,
}: QuickVitalsModalProps) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [spo2, setSpo2] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setSystolic('');
    setDiastolic('');
    setHeartRate('');
    setTemperature('');
    setSpo2('');
    setNotes('');
    setFormError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const data: Record<string, unknown> = {};

    if (systolic.trim() || diastolic.trim()) {
      const sysNum = Number(systolic);
      const diaNum = Number(diastolic);
      if (
        !systolic.trim() ||
        !diastolic.trim() ||
        Number.isNaN(sysNum) ||
        Number.isNaN(diaNum) ||
        sysNum < 50 ||
        sysNum > 260 ||
        diaNum < 30 ||
        diaNum > 180
      ) {
        setFormError('Please enter valid systolic (50–260) and diastolic (30–180) blood pressure values.');
        return;
      }
      data.blood_pressure = `${sysNum}/${diaNum} mmHg`;
      data.systolic = sysNum;
      data.diastolic = diaNum;
    }

    if (heartRate.trim()) {
      const hrNum = Number(heartRate);
      if (Number.isNaN(hrNum) || hrNum < 30 || hrNum > 240) {
        setFormError('Heart rate must be between 30 and 240 bpm.');
        return;
      }
      data.heart_rate = `${hrNum} bpm`;
    }

    if (temperature.trim()) {
      const tempNum = Number(temperature);
      if (Number.isNaN(tempNum) || tempNum < 90 || tempNum > 110) {
        setFormError('Body temperature must be between 90°F and 110°F.');
        return;
      }
      data.temperature = `${tempNum} °F`;
    }

    if (spo2.trim()) {
      const spo2Num = Number(spo2);
      if (Number.isNaN(spo2Num) || spo2Num < 50 || spo2Num > 100) {
        setFormError('SpO2 must be between 50% and 100%.');
        return;
      }
      data.spo2 = `${spo2Num}%`;
    }

    if (notes.trim()) {
      data.notes = notes.trim();
    }

    if (Object.keys(data).length === 0) {
      setFormError('Please enter at least one vital sign measurement.');
      return;
    }

    const ok = await onSave({
      record_type: 'vital_signs',
      data,
      source: 'user_entered',
      recorded_at: new Date().toISOString(),
    });

    if (ok) {
      handleClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Log Vital Signs" size="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            id="vital-systolic"
            label="Systolic BP (mmHg)"
            type="number"
            min={50}
            max={260}
            placeholder="e.g. 120"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
          />
          <Input
            id="vital-diastolic"
            label="Diastolic BP (mmHg)"
            type="number"
            min={30}
            max={180}
            placeholder="e.g. 80"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            id="vital-hr"
            label="Heart Rate (bpm)"
            type="number"
            min={30}
            max={240}
            placeholder="e.g. 72"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
          />
          <Input
            id="vital-temp"
            label="Temp (°F)"
            type="number"
            step="0.1"
            min={90}
            max={110}
            placeholder="e.g. 98.6"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
          <Input
            id="vital-spo2"
            label="SpO2 (%)"
            type="number"
            min={50}
            max={100}
            placeholder="e.g. 98"
            value={spo2}
            onChange={(e) => setSpo2(e.target.value)}
          />
        </div>

        <div>
          <label
            htmlFor="vital-notes"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Notes (optional)
          </label>
          <textarea
            id="vital-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context (e.g. measured after resting, post-medication)..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save Vitals
          </Button>
        </div>
      </form>
    </Modal>
  );
}
