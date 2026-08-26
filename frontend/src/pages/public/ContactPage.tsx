/**
 * ContactPage component - Contact page for PulseDesk.
 * 
 * Professional contact form with validation.
 * Note: Backend integration is deferred - form UI only.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { CONTACT_CONTENT } from '../../features/public/content';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

/**
 * ContactPage component
 */
export function ContactPage() {
  useEffect(() => {
    document.title = 'Contact — PulseDesk';
  }, []);

  const [formData, setFormData] = useState<ContactForm>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitStatus('submitting');

    // Backend integration deferred - simulate submission
    // In production, this would call a contact API endpoint
    setTimeout(() => {
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 1000);
  };

  const handleChange = (field: keyof ContactForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {CONTACT_CONTENT.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {CONTACT_CONTENT.subtitle}
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Contact Info */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground">
                {CONTACT_CONTENT.info.title}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {CONTACT_CONTENT.info.description}
              </p>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {submitStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-base font-medium text-foreground">
                    {CONTACT_CONTENT.form.success}
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => setSubmitStatus('idle')}
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground">
                      {CONTACT_CONTENT.form.name}
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="mt-1"
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      aria-invalid={errors.name ? 'true' : undefined}
                    />
                    {errors.name && (
                      <p id="name-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground">
                      {CONTACT_CONTENT.form.email}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="mt-1"
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      aria-invalid={errors.email ? 'true' : undefined}
                    />
                    {errors.email && (
                      <p id="email-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-foreground">
                      {CONTACT_CONTENT.form.subject}
                    </label>
                    <Input
                      id="subject"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      className="mt-1"
                      aria-describedby={errors.subject ? 'subject-error' : undefined}
                      aria-invalid={errors.subject ? 'true' : undefined}
                    />
                    {errors.subject && (
                      <p id="subject-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                        {errors.subject}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-foreground">
                      {CONTACT_CONTENT.form.message}
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={formData.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      aria-describedby={errors.message ? 'message-error' : undefined}
                      aria-invalid={errors.message ? 'true' : undefined}
                    />
                    {errors.message && (
                      <p id="message-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                        {errors.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" fullWidth isLoading={submitStatus === 'submitting'} className="gap-2">
                    {submitStatus === 'submitting' ? CONTACT_CONTENT.form.submitting : (
                      <>
                        {CONTACT_CONTENT.form.submit}
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>

                  {submitStatus === 'error' && (
                    <p className="text-sm text-red-600 dark:text-red-400 text-center" role="alert">
                      {CONTACT_CONTENT.form.error}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Note: Contact form backend integration is deferred. This is a UI demonstration.
                  </p>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
