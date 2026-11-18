import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Cpu,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';

export function AboutPage() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <Link
            to={user ? '/dashboard' : '/'}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {user ? 'Back to Dashboard' : 'Back to Home'}
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            About AI Health Monitor
          </h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Understanding how our AI health assistant works, our medical safety
            boundaries, and how we protect your privacy.
          </p>
        </div>

        {/* Prominent Medical Disclaimer */}
        <div
          role="note"
          className="rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-bold">Important Medical Disclaimer</h2>
              <p className="mt-1.5 text-sm leading-relaxed">
                AI Health Monitor is designed strictly for personal health tracking,
                symptom organization, and general educational information. It is{' '}
                <strong>not a medical device</strong> and does{' '}
                <strong>not provide medical diagnoses, prescriptions, or treatment</strong>.
                Always consult a qualified physician or licensed healthcare provider
                for medical advice. Never disregard professional medical advice or delay
                seeking care because of information provided by this application.
              </p>
              <p className="mt-2 text-sm font-semibold">
                For urgent or life-threatening emergencies, call{' '}
                <a href="tel:112" className="underline">
                  112
                </a>{' '}
                or{' '}
                <a href="tel:108" className="underline">
                  108
                </a>{' '}
                immediately, or visit our{' '}
                <Link to="/emergency" className="underline">
                  Emergency Helplines page
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* How AI Health Assistance Works */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-900">
              How AI Health Assistance Works
            </h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-gray-700">
            <p>
              AI Health Monitor combines conversational health guidance, multimodal
              image analysis, structured vital sign logging, and automated PDF report
              generation in one workspace.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Contextual Conversations:</strong> Discuss symptoms and health
                questions while referencing your optional profile details (allergies
                and medical conditions).
              </li>
              <li>
                <strong>Multimodal Image Review:</strong> Upload JPG, PNG, or WebP
                images to receive structured educational observations and suggested
                follow-up questions for a doctor.
              </li>
              <li>
                <strong>Safety & Emergency Screening:</strong> Messages are
                automatically checked for red-flag emergency indicators so urgent
                helpline contacts are surfaced immediately.
              </li>
              <li>
                <strong>Clinician-Ready Summaries:</strong> Export selected
                conversations and vital signs into organized PDF reports to bring to
                your medical appointments.
              </li>
            </ul>
          </div>
        </Card>

        {/* Privacy Policy Summary */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-900">
              Privacy Policy Summary
            </h2>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
            <li>
              <strong>User-Scoped Isolation:</strong> All records, conversations,
              images, and reports require authenticated access and are isolated to your
              account.
            </li>
            <li>
              <strong>Explicit Consent:</strong> You control data collection and AI
              processing consent toggles at any time from your Privacy Settings page.
            </li>
            <li>
              <strong>Data Portability:</strong> Export all your personal data as a
              JSON archive whenever you choose.
            </li>
            <li>
              <strong>Right to Erasure:</strong> Deleting your account permanently
              removes your profile, conversations, records, images, and reports.
            </li>
          </ul>
        </Card>

        {/* Technology & Contact */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-900">
                Technology Credits
              </h2>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li>• React, TypeScript, Vite & Tailwind CSS</li>
              <li>• FastAPI Python Backend Services</li>
              <li>• Google Gemini Multimodal AI</li>
              <li>• Supabase Authentication, PostgreSQL & Storage</li>
              <li>• ReportLab PDF Document Generation</li>
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-900">
                Contact & Support
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">
              For privacy inquiries, data protection requests, or technical feedback
              regarding AI Health Monitor, reach out to our support team:
            </p>
            <p className="mt-3 text-sm font-medium text-blue-600">
              <a
                href="mailto:support@aihealthmonitor.app"
                className="hover:underline"
              >
                support@aihealthmonitor.app
              </a>
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Note: This email is for technical and privacy support only — never send
              urgent medical emergencies via email.
            </p>
          </Card>
        </div>
      </main>
    </div>
  );
}
