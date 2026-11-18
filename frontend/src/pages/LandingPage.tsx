import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: MessageSquare,
    title: 'AI Health Assistant Chat',
    description:
      'Discuss symptoms, track daily wellness, and get structured, evidence-informed health guidance with full conversation history.',
  },
  {
    icon: ImageIcon,
    title: 'Medical Image Analysis',
    description:
      'Upload clear images such as skin concerns, prescriptions, or lab documents for structured multimodal AI review.',
  },
  {
    icon: FileText,
    title: 'Doctor-Ready Health Reports',
    description:
      'Compile selected conversations and recorded vital signs into downloadable PDF reports you can share with your clinician.',
  },
  {
    icon: AlertTriangle,
    title: 'Real-Time Emergency Detection',
    description:
      'Automatic screening for red-flag symptoms with immediate emergency helpline guidance and crisis support contacts.',
  },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                Personal AI Health Monitoring Platform
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Monitor your health with clarity, privacy, and intelligent guidance.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
                Track symptoms and vital signs, analyze health images, and generate
                structured PDF summaries for your doctor — backed by privacy-first
                controls and real-time emergency awareness.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {user ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Open Dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      Create Free Account
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Sign In
                    </Link>
                  </>
                )}
                <Link
                  to="/emergency"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Emergency Helplines
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900">
              Built for informed health tracking
            </h2>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Every tool is designed to help you organize your health information and
              prepare better questions for licensed healthcare professionals.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy & Trust Band */}
        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <ShieldCheck
                  className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Granular Privacy & Consent Controls
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Manage data collection and AI processing consent anytime, export all
                    your health records in JSON, or permanently delete your account.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
                <Lock
                  className="mt-0.5 h-6 w-6 shrink-0 text-blue-600"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Authenticated, Isolated Health Records
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Your conversations, uploaded medical images, vital signs, and PDF
                    reports remain scoped exclusively to your verified account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Medical Disclaimer */}
      <footer className="border-t border-gray-200 bg-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
            <strong>Medical Disclaimer:</strong> AI Health Monitor is an informational
            health monitoring assistant and is <strong>not</strong> a substitute for
            professional medical advice, diagnosis, or treatment. Always consult a
            qualified physician or healthcare provider regarding any medical condition.
            If you are experiencing a medical emergency, call <strong>112</strong> or{' '}
            <strong>108</strong> immediately.
          </div>

          <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-gray-200 pt-6 text-xs text-gray-600 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} AI Health Monitor. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-5">
              <Link to="/about" className="hover:text-blue-600 hover:underline">
                About & Privacy
              </Link>
              <Link to="/emergency" className="font-medium text-red-700 hover:underline">
                Emergency Helplines
              </Link>
              <Link to="/login" className="hover:text-blue-600 hover:underline">
                Sign In
              </Link>
              <Link to="/register" className="hover:text-blue-600 hover:underline">
                Register
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
