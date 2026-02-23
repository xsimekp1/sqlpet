'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Shield, ShieldCheck, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

interface TwoFASectionProps {
  user: {
    id: string;
    email: string;
    name: string;
    totp_enabled: boolean;
  } | null;
}

export function TwoFASection({ user }: TwoFASectionProps) {
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qr_code: string;
    provisioning_uri: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'done'>('initial');

  const initiateSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/setup`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error' }));
        throw new Error(err.detail || 'Error');
      }
      const data = await res.json();
      setSetupData(data);
      setStep('setup');
    } catch (err: any) {
      toast.error(err.message || 'Nepodařilo se zahájit nastavení 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Zadejte 6místný kód');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/verify`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Invalid code' }));
        throw new Error(err.detail || 'Invalid code');
      }
      toast.success('2FA je aktivní!');
      setBackupCodes([]);
      setStep('done');
    } catch (err: any) {
      toast.error(err.message || 'Neplatný kód');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Opravdu chcete vypnout dvoufaktorovou autentifikaci?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/disable`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error' }));
        throw new Error(err.detail || 'Error');
      }
      toast.success('2FA bylo vypnuto');
      setSetupData(null);
      setStep('initial');
    } catch (err: any) {
      toast.error(err.message || 'Nepodařilo se vypnout 2FA');
    } finally {
      setLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/backup-codes`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setBackupCodes(data.codes);
      toast.success('Nové záložní kódy byly vygenerovány');
    } catch {
      toast.error('Nepodařilo se regenerovat kódy');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Zkopírováno do schránky');
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {user.totp_enabled || step === 'done' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <ShieldCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">2FA je aktivní</p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Váš účet je chráněn dvoufaktorovou autentifikací
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Záložní kódy</h4>
            <p className="text-sm text-muted-foreground">
              Tyto kódy můžete použít, pokud ztratíte přístup k autentifikátoru.
              Uložte si je na bez lugar.
            </p>
            {backupCodes.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded font-mono text-sm"
                  >
                    <span>{code}</span>
                    <button
                      onClick={() => copyToClipboard(code)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={regenerateBackupCodes} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Zobrazit záložní kódy
              </Button>
            )}
          </div>

          <Button variant="destructive" onClick={disable2FA} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Vypnout 2FA
          </Button>
        </div>
      ) : step === 'initial' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">Zapnout dvoufaktorovou autentifikaci</p>
              <p className="text-sm text-muted-foreground">
                Po přihlášení budete muset zadat kód z autentifikátoru (Google Auth, Authy, atd.)
              </p>
            </div>
          </div>
          <Button onClick={initiateSetup} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Nastavit 2FA
          </Button>
        </div>
      ) : step === 'setup' && setupData ? (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Naskenujte QR kód</h3>
            <p className="text-sm text-muted-foreground">
              Naskenujte tento kód pomocí aplikace jako Google Authenticator nebo Authy
            </p>
          </div>

          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${setupData.qr_code}`}
              alt="2FA QR Code"
              className="border rounded-lg"
            />
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Nebo zadejte tento kód ručně:</p>
            <code className="px-3 py-1 bg-muted rounded font-mono text-lg">{setupData.secret}</code>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <label className="text-sm font-medium">Zadejte kód z autentifikátoru pro ověření:</label>
            <div className="flex gap-2">
              <Input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="font-mono text-lg text-center tracking-widest"
              />
              <Button onClick={verifyAndEnable} disabled={loading || verifyCode.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Ověřit
              </Button>
            </div>
          </div>

          <Button variant="ghost" onClick={() => { setStep('initial'); setSetupData(null); }}>
            Zrušit
          </Button>
        </div>
      ) : null}
    </div>
  );
}
