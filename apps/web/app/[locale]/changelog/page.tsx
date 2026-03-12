'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function ChangelogPage() {
  return (
    <div 
      className="changelog-page"
      style={{ 
        background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ background: 'transparent' }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -left-24 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 right-1/4 w-80 h-80 rounded-full bg-white/5" />
      </div>

      <div className="relative z-10" style={{ position: 'relative', zIndex: 10 }}>
        {/* Header */}
        <header className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between">
            <Link href="/cs" className="flex items-center gap-2">
              <Image
                src="/petslog.png"
                alt="Petslog"
                width={140}
                height={93}
                className="drop-shadow-md"
                priority
              />
            </Link>
            <Link href="/cs">
              <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 bg-transparent">
                Zpět na úvod
              </Button>
            </Link>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16" style={{ background: 'transparent' }}>
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              🐾 Petslog Changelog
            </h1>
            <p className="text-teal-100 text-lg">
              Co je nového v útulkovém systému
            </p>
          </div>

          {/* Week 11-12.3 */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 11. – 12. března 2026</span>
              <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">NOVÉ</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">📊 Historie spotřeby krmiva</span>
                <p className="text-teal-100 text-sm mt-1">
                  Nový přehled kolik kterého krmiva zvíře snědlo za 7/30/90/365 dní.
                  Report i přímo na kartě zvířete.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🏨 Vylepšený hotel</span>
                <p className="text-teal-100 text-sm mt-1">
                  Kompletně přepracovaný formulář rezervací – rychlejší zápis z telefonu,
                  lepší kontrola dostupnosti kotců.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">📦 Automatický odpočet skladu</span>
                <p className="text-teal-100 text-sm mt-1">
                  Při dokončení úkolu s přiřazenou položkou skladu se automaticky odečte množství.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">👤 Profilové fotky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Uživatelé si mohou nahrát profilovou fotku v nastavení účtu.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🔧 Řazení úkolů</span>
                <p className="text-teal-100 text-sm mt-1">
                  Vylepšené řazení seznamu úkolů podle data splnění a priority.
                </p>
              </div>
            </div>
          </section>

          {/* Week 3-10.3 */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 3. – 10. března 2026</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">📱 Velká oprava mobilního UI</span>
                <p className="text-teal-100 text-sm mt-1">
                  Kompletní přepracování layoutu pro malé obrazovky – tlačítka přestala přetékat,
                  tabulky se dají číst celé, obsah není překrytý navigací.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🧪 Testování mobilní aplikace</span>
                <p className="text-teal-100 text-sm mt-1">
                  Probíhá interní testování nativní mobilní aplikace pro iOS a Android. Brzy spustíme uzavřenou betu – sledujte novinky!
                </p>
              </div>
            </div>
          </section>

          {/* Week 23.2 - 1.3 */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 23. února – 1. března 2026</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">💬 Chat v mobilní aplikaci</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interní messaging přímo v mobilní app – komunikujte s týmem z terénu.
                </p>
              </div>
            </div>
          </section>

          {/* Week 16-22.2. */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 16. – 22. února 2026</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">🍖 Widget spotřeby krmiva</span>
                <p className="text-teal-100 text-sm mt-1">
                  Dashboard widget zobrazující denní spotřebu krmiva – kolik gramů kterého krmiva je potřeba.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🌐 Přesun na pets-log.com</span>
                <p className="text-teal-100 text-sm mt-1">
                  Web je nyní dostupný na nové doméně pets-log.com.
                </p>
              </div>
            </div>
          </section>

          {/* Week 24-25.2. */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 24. – 25. února 2026</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">🔑 Dvoufaktorová autentifikace (2FA)</span>
                <p className="text-teal-100 text-sm mt-1">
                  Volitelná 2FA pomocí Google Authenticator. Záložní kódy pro případ ztráty telefonu. 
                  Superadmin může spravovat 2FA pro ostatní uživatele.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🛠️ Stránka Funkce</span>
                <p className="text-teal-100 text-sm mt-1">
                  Přehled všech funkcí systému na samostatné stránce – včetně screenshotů.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🔒 GDPR a bezpečnost</span>
                <p className="text-teal-100 text-sm mt-1">
                  Data v EU cloudu, info o šifrování a GDPR na nové sekci landing page.
                </p>
              </div>
            </div>
          </section>

          {/* Week 7-13.2. */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 7. – 13. února 2026</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">🔍 Chytré vyhledávání</span>
                <p className="text-teal-100 text-sm mt-1">
                  Hledejte zvířata, lidi, úkoly i funkce – najde i synonyma jako „pes" nebo „pesák".
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🛒 Nákupní objednávky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Kompletní systém objednávek a sledování dodávek do skladu.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🔒 GDPR</span>
                <p className="text-teal-100 text-sm mt-1">
                  Logy přihlášení, export dat, automatické generování DPA smlouvy.
                </p>
              </div>
            </div>
          </section>

          {/* Starší novinky */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 text-sm">📅 Starší novinky</span>
            </h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
              <div>
                <span className="font-semibold text-white">💉 Očkovací průkazy</span>
                <p className="text-teal-100 text-sm mt-1">
                  Sledování vakcinací s upozorněním na končící platnost.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">⚖️ Legální lhůty</span>
                <p className="text-teal-100 text-sm mt-1">
                  Automatické výpočty lhůt pro nalezená zvířata (2 a 4 měsíce).
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🗺️ Mapa nálezů</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interaktivní mapa nalezených zvířat s pokročilými filtry.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🏨 Hotel</span>
                <p className="text-teal-100 text-sm mt-1">
                  Rezervace a přehled psů v hotelovém pobytu.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">💬 Chat</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interní messaging pro komunikaci v týmu útulku.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🎀 Barevné obojky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Sledování barvy obojku – skvělé pro velké útulky.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🏨 Hotel</span>
                <p className="text-teal-100 text-sm mt-1">
                  Rezervace a přehled psů v hotelovém pobytu.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">💬 Chat</span>
                <p className="text-teal-100 text-sm mt-1">
                  Interní messaging pro komunikaci v týmu útulku.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🎀 Barevné obojky</span>
                <p className="text-teal-100 text-sm mt-1">
                  Sledování barvy obojku – skvělé pro velké útulky.
                </p>
              </div>
              <div>
                <span className="font-semibold text-white">🎨 Témata</span>
                <p className="text-teal-100 text-sm mt-1">
                  3 barevná schémata: Teal Shelter, Berry Rescue, Safari.
                </p>
              </div>
            </div>
          </section>

          {/* Footer note */}
          <div className="text-center pt-8 border-t border-white/10">
            <p className="text-teal-200 text-sm">
              Changelog vychází každý pátek večer 🚀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
