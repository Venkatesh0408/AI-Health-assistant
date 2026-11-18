import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '../utils/validators';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PasswordStrengthIndicator } from '../components/auth/PasswordStrengthIndicator';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const nameCheck = validateDisplayName(displayName);
    const emailCheck = validateEmail(email);
    const passwordCheck = validatePassword(password);
    const confirmMatches = password === confirmPassword;

    const nextErrors = {
      displayName: nameCheck.valid ? undefined : nameCheck.error,
      email: emailCheck.valid ? undefined : emailCheck.error,
      password: passwordCheck.valid ? undefined : passwordCheck.error,
      confirmPassword: confirmMatches ? undefined : 'Passwords do not match.',
      terms: acceptedTerms
        ? undefined
        : 'You must agree to the terms, privacy policy, and medical disclaimer.',
    };

    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);
    try {
      const { error, requiresEmailVerification } = await signUp(
        email,
        password,
        displayName
      );
      if (error) {
        setSubmitError(error);
        return;
      }

      if (requiresEmailVerification) {
        setVerificationSent(true);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="mt-1 text-sm text-gray-600">
              Start tracking your health with AI-assisted monitoring.
            </p>
          </div>

          <Card>
            {verificationSent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Verify your email address
                </h2>
                <p className="text-sm text-gray-600">
                  We have sent a verification link to{' '}
                  <span className="font-medium text-gray-900">{email}</span>. Please
                  click the link in your email to activate your account, then sign in.
                </p>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Go to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSubmit(e)}
                noValidate
                className="space-y-4"
              >
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
                  id="register-name"
                  name="displayName"
                  type="text"
                  label="Full Name / Display Name"
                  autoComplete="name"
                  required
                  placeholder="Dr. Jane Doe or Alex Smith"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (errors.displayName) {
                      setErrors((prev) => ({ ...prev, displayName: undefined }));
                    }
                  }}
                  error={errors.displayName}
                />

                <Input
                  id="register-email"
                  name="email"
                  type="email"
                  label="Email Address"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  error={errors.email}
                />

                <div>
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    label="Password"
                    autoComplete="new-password"
                    required
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    error={errors.password}
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>

                <Input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type="password"
                  label="Confirm Password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  error={errors.confirmPassword}
                />

                <div>
                  <label className="flex items-start gap-2.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked);
                        if (errors.terms) {
                          setErrors((prev) => ({ ...prev, terms: undefined }));
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      I acknowledge that AI Health Monitor provides informational
                      guidance only (not medical diagnosis) and I accept the{' '}
                      <Link
                        to="/about"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Privacy Policy & Medical Disclaimer
                      </Link>
                      .
                    </span>
                  </label>
                  {errors.terms && (
                    <p role="alert" className="mt-1 text-xs text-red-600">
                      {errors.terms}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                  className="w-full"
                >
                  Create Account
                </Button>
              </form>
            )}

            {!verificationSent && (
              <p className="mt-5 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
