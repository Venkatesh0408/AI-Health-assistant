import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ambulance,
  HeartHandshake,
  PhoneCall,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';

const primaryNumbers = [
  {
    number: '112',
    title: 'National Emergency Number',
    description:
      'All-in-one pan-India emergency response for medical, fire, police, or disaster emergencies.',
    whenToCall:
      'Call 112 whenever you are unsure which emergency service is needed, or when multiple responders are required.',
    icon: AlertTriangle,
    accent: 'border-red-300 bg-red-50 text-red-800',
  },
  {
    number: '108',
    title: 'Emergency Ambulance Service',
    description:
      '24/7 emergency medical transport with trained paramedics for acute medical and trauma situations.',
    whenToCall:
      'Chest pain, severe difficulty breathing, stroke symptoms, severe bleeding, unconsciousness, or serious accidents.',
    icon: Ambulance,
    accent: 'border-red-300 bg-red-50 text-red-800',
  },
  {
    number: '100',
    title: 'Police Emergency',
    description:
      'Immediate law enforcement assistance for personal safety threats, assault, or emergencies requiring police intervention.',
    whenToCall:
      'Immediate danger to personal safety, domestic emergencies, road accidents requiring traffic/police aid.',
    icon: ShieldAlert,
    accent: 'border-blue-300 bg-blue-50 text-blue-800',
  },
];

const mentalHealthNumbers = [
  {
    name: 'AASRA Helpline',
    number: '9152987821',
    hours: '24/7 Confidential Crisis Support',
    description:
      'Free, confidential emotional support for individuals experiencing distress, depression, or suicidal thoughts.',
  },
  {
    name: 'iCall Psychosocial Helpline',
    number: '9152987821',
    hours: 'Monday – Saturday, 8:00 AM – 10:00 PM',
    description:
      'Professional counseling and mental health support run by trained counselors (TISS).',
  },
];

const emergencyGuides = [
  {
    title: 'Chest Pain or Suspected Heart Attack',
    call: '108 or 112',
    steps: [
      'Call 108 or 112 immediately — do not drive yourself to the hospital.',
      'Sit down, stay calm, and loosen any tight clothing.',
      'If prescribed nitroglycerin, follow your doctor’s instructions.',
      'If the person becomes unresponsive and stops breathing normally, begin CPR if trained.',
    ],
  },
  {
    title: 'Signs of Stroke (F.A.S.T.)',
    call: '108 or 112',
    steps: [
      'Face drooping, Arm weakness, Speech difficulty — Time to call emergency services immediately.',
      'Note the exact time symptoms started to inform emergency doctors.',
      'Do not give food, water, or medication until evaluated by medical personnel.',
    ],
  },
  {
    title: 'Severe Bleeding or Trauma',
    call: '108 or 112',
    steps: [
      'Apply firm, direct pressure to the wound using a clean cloth or sterile gauze.',
      'Keep the person warm and still; do not remove deeply embedded objects.',
      'Call emergency services right away and keep pressure applied until help arrives.',
    ],
  },
  {
    title: 'Mental Health Crisis or Self-Harm Risk',
    call: 'AASRA / iCall (9152987821) or 112',
    steps: [
      'Call 9152987821 immediately to speak with a trained crisis counselor.',
      'Stay with a trusted family member or friend if possible.',
      'If there is immediate physical danger, call 112 or go to the nearest emergency room.',
    ],
  },
];

export function EmergencyPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            to={user ? '/dashboard' : '/'}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {user ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
        </div>

        {/* Urgent Banner */}
        <div
          role="alert"
          className="mb-8 rounded-xl border-2 border-red-600 bg-red-600 p-6 text-white shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-xl font-bold sm:text-2xl">
                  Emergency Helplines & Urgent Care
                </h1>
                <p className="mt-1 text-sm text-red-50">
                  If you or someone near you is experiencing a life-threatening medical
                  or safety emergency, do not wait for AI responses. Call emergency
                  services immediately.
                </p>
              </div>
            </div>
            <a
              href="tel:112"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-bold text-red-700 shadow hover:bg-red-50"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              Call 112 Now
            </a>
          </div>
        </div>

        {/* Primary Emergency Numbers */}
        <section aria-labelledby="primary-helplines-heading" className="mb-10">
          <h2
            id="primary-helplines-heading"
            className="mb-4 text-lg font-bold text-gray-900"
          >
            National Emergency Services
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {primaryNumbers.map(
              ({ number, title, description, whenToCall, icon: Icon, accent }) => (
                <Card key={number} className="flex flex-col justify-between">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${accent}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {title}
                      </span>
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight text-gray-900">
                      {number}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">{description}</p>
                    <p className="mt-3 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700">
                      <strong>When to call:</strong> {whenToCall}
                    </p>
                  </div>
                  <div className="mt-4">
                    <a
                      href={`tel:${number}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      <PhoneCall className="h-4 w-4" aria-hidden="true" />
                      Call {number}
                    </a>
                  </div>
                </Card>
              )
            )}
          </div>
        </section>

        {/* Mental Health Support */}
        <section aria-labelledby="mental-health-heading" className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2
              id="mental-health-heading"
              className="text-lg font-bold text-gray-900"
            >
              Mental Health & Crisis Support
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mentalHealthNumbers.map((helpline) => (
              <Card key={helpline.name} className="border-emerald-200">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {helpline.name}
                    </h3>
                    <p className="text-xs font-medium text-emerald-700">
                      {helpline.hours}
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {helpline.description}
                    </p>
                  </div>
                  <a
                    href={`tel:${helpline.number}`}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <PhoneCall className="h-4 w-4" aria-hidden="true" />
                    {helpline.number}
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Step-by-Step Emergency Instructions */}
        <section aria-labelledby="instructions-heading">
          <h2
            id="instructions-heading"
            className="mb-4 text-lg font-bold text-gray-900"
          >
            What To Do While Waiting for Help
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {emergencyGuides.map((guide) => (
              <Card key={guide.title}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900">
                    {guide.title}
                  </h3>
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                    Call {guide.call}
                  </span>
                </div>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-700">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
