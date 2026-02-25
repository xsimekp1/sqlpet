'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfUsePage() {
  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link href="/en">
            <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to home
            </Button>
          </Link>
        </header>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-8 space-y-6 text-teal-50">
          <h1 className="text-3xl font-bold text-white">Terms of Use for Petslog</h1>
          <p className="text-teal-200">Effective from: March 1, 2026</p>

          <hr className="border-white/10" />

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Operator</h2>
            <p>
              The operator of Petslog is Pavel Šimek (individual), ID No.: 21555401, 
              contact: pavel@petslog.com.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Testing Mode (Beta)</h2>
            <p>
              The service is provided in testing mode. Features may change, be temporarily 
              unavailable, or be discontinued. We may adjust settings and service structure 
              to improve functionality.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Account and Registration</h2>
            <p>
              During registration, you must provide accurate information and protect your 
              login credentials. You are responsible for activities under your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Usage Rules</h2>
            <p>
              You must not misuse the service (e.g., attempts to attack, bypass security, 
              spam, uploading illegal content, disrupting operations). 
              If you violate the rules, we may limit or revoke access to your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">User Content and Data</h2>
            <p>
              If you enter content into Petslog (e.g., notes, animal information, photos), 
              you declare that you have the right to use it. You grant us a non-exclusive 
              right to process this content solely for the purpose of providing and 
              improving the service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Free Provision</h2>
            <p>
              Currently, the service is provided free of charge. In the future, we may 
              introduce paid features or tariffs; any changes will be communicated in advance.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Health and Professional Information</h2>
            <p>
              If Petslog contains recommendations or care reminders, they are for informational 
              purposes only and do not replace veterinary examination or professional care. 
              In acute cases, always contact a veterinarian.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Availability and Limitation of Liability</h2>
            <p>
              We provide the service "as is". We do not guarantee uninterrupted availability 
              or error-free operation. To the extent permitted by law, we are not liable for 
              damages arising from using or being unable to use the service, including data 
              loss. We recommend backing up important data.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Termination of Service / Account</h2>
            <p>
              You may cancel your account at any time by emailing pavel@petslog.com. 
              We may terminate the service or account especially in cases of misuse or 
              for technical/organizational reasons.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Changes to Terms</h2>
            <p>
              We may modify these terms. The current version will always be available on 
              this page; the effective date will be indicated at the top.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Dispute Resolution</h2>
            <p>
              These terms are governed by the laws of the Czech Republic. Any disputes 
              will be resolved by the appropriate courts in the Czech Republic.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <p>© 2026 Petslog. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
