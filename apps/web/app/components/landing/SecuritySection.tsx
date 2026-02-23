'use client';

import { Badge } from '@/components/ui/badge';

export function SecuritySection() {
  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            🔒 Bezpečnost a GDPR
          </h2>
          <p className="text-gray-500">
            Vaše data jsou v bezpečí
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">🌍</div>
            <h3 className="font-semibold text-gray-900 mb-2">Data v EU</h3>
            <p className="text-sm text-gray-600">
              Všechna data ukládáme v cloudu v EU (AWS/Google Cloud region Frankfurt). 
              Splňujeme tak GDPR automaticky — cloud v EU je sám o sobě dostatečný 
              z právního hlediska, ukládáte-li osobní data občanů EU.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">📤</div>
            <h3 className="font-semibold text-gray-900 mb-2">Vaše data jsou vaše</h3>
            <p className="text-sm text-gray-600">
              Kdykoliv můžete exportovat všechna svá data v CSV nebo PDF. 
              Nesnažíme se vás uzamknout. Pokud se rozhodnete odejít, 
              data dostanete v běžných formátech.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">🔐</div>
            <h3 className="font-semibold text-gray-900 mb-2">Šifrování</h3>
            <p className="text-sm text-gray-600">
              Data jsou šifrována jak při přenosu (TLS), tak na disku (AES-256).
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">🔑</div>
            <h3 className="font-semibold text-gray-900 mb-2">Dvoufaktorová autentifikace</h3>
            <p className="text-sm text-gray-600">
              Volitelná 2FA pomocí Google Authenticator nebo podobných aplikací. 
              Záložní kódy pro případ ztráty telefonu.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-3">📋</div>
            <h3 className="font-semibold text-gray-900 mb-2">Audit log</h3>
            <p className="text-sm text-gray-600">
              Všechny změny se zaznamenávají — kdo, co a kdy změnil. 
              Máte přehled o veškeré aktivitě v systému.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
