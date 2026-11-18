import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/common/Modal';

export function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath =
    (location.state as { from?: string } | null)?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const emailCheck = validateEmail(email);
    setEmailError(emailCheck.valid ? undefined : emailCheck.error);

    const hasPassword = password.length > 0;
    setPasswordError(hasPassword ? undefined : 'Password is required.');

    if (!emailCheck.valid || !hasPassword) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setSubmitError(error);
        return;
      }
      navigate(fromPath, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setResetError(null);
    setResetSuccess(false);

    const check = validateEmail(resetEmail);
    if (!check.valid) {
      setResetError(check.error || 'Please enter a valid email address.');
      return;
    }

    setResetSubmitting(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (error) {
        setResetError(error);
      } else {
        setResetSuccess(true);
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Activity className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Sign in to your account</h1>
            <p className="mt-1 text-sm text-gray-600">
              Access your personal health records and AI consultations.
            </p>
          </div>

          <Card>
            <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              )}

              <Input
                id="login-email"
                name="email"
                type="email"
                label="Email Address"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(undefined);
                }}
                error={emailError}
              />

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password <span className="text-red-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetError(null);
                      setResetSuccess(false);
                      setResetOpen(true);
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(undefined);
                  }}
                  error={passwordError}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                className="w-full"
              >
                Sign In
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 hover:underline"
              >
                Create an account
              </Link>
            </p>
          </Card>
        </div>
      </main>

      <Modal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Password"
        size="sm"
      >
        {resetSuccess ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <p>
                If an account exists for <strong>{resetEmail}</strong>, a password
                reset link has been sent. Please check your inbox and spam folder.
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setResetOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleForgotPassword(e)}
            noValidate
            className="space-y-4"
          >
            <p className="text-sm text-gray-600">
              Enter your registered email address and we will send you a password reset
              link.
            </p>
            {resetError && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {resetError}
              </p>
            )}
            <Input
              id="reset-email"
              type="email"
              label="Email Address"
              required
              placeholder="you@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResetOpen(false)}
                disabled={resetSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={resetSubmitting}>
                Send Reset Link
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
