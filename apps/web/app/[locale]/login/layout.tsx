import { ReactNode } from 'react';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/petslog.png"
            alt="Petslog"
            width={360}
            height={240}
            className="drop-shadow-md"
            priority
          />
        </div>
        {children}
      </div>
    </div>
  );
}
