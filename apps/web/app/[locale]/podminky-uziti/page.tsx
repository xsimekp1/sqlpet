'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfUsePage() {
  const params = useParams();
  const locale = params.locale as string;
  const isCs = locale === 'cs' || locale === 'sk';

  const content = isCs ? {
    back: 'Zpět na hlavní stránku',
    title: 'Podmínky užití Petslog',
    effectiveFrom: 'Účinné od: 1. března 2026',
    sections: [
      {
        title: 'Provozovatel',
        text: 'Provozovatelem služby Petslog je Pavel Šimek (fyzická osoba), IČO: 21555401, kontakt: pavel@petslog.com.'
      },
      {
        title: 'Testovací režim (beta)',
        text: 'Služba je poskytována v testovacím režimu. Funkce se mohou měnit, být dočasně nedostupné nebo být ukončeny. Můžeme upravovat nastavení a strukturu služby tak, aby se zlepšovala.'
      },
      {
        title: 'Účet a registrace',
        text: 'Při registraci uvádíte pravdivé údaje a chráníte své přihlašovací údaje. Jste odpovědní za činnost pod vaším účtem.'
      },
      {
        title: 'Pravidla používání',
        text: 'Nesmíte službu zneužívat (např. pokusy o napadení, obcházení zabezpečení, spam, nahrávání nezákonného obsahu, narušování provozu). Při porušení pravidel můžeme omezit nebo zrušit přístup k účtu.'
      },
      {
        title: 'Uživatelský obsah a data',
        text: 'Pokud do Petslog zadáváte obsah (např. poznámky, údaje o zvířeti, fotografie), prohlašujete, že k němu máte právo jej používat. Udělujete nám nevýhradní oprávnění tento obsah zpracovat pouze za účelem poskytování a zlepšování služby.'
      },
      {
        title: 'Bezplatné poskytování',
        text: 'V současnosti je služba poskytována zdarma. V budoucnu můžeme zavést placené funkce nebo tarify; případné změny budeme komunikovat předem.'
      },
      {
        title: 'Zdravotní a odborné informace',
        text: 'Pokud Petslog obsahuje doporučení nebo připomínky k péči, slouží pouze informativně a nenahrazuje veterinární vyšetření ani odbornou péči. V akutních případech se vždy obraťte na veterináře.'
      },
      {
        title: 'Dostupnost a omezení odpovědnosti',
        text: 'Službu poskytujeme „tak jak je". Nezaručujeme nepřetržitou dostupnost ani bezchybnost. V rozsahu dovoleném právem neneseme odpovědnost za škody vzniklé používáním nebo nemožností používat službu, včetně ztráty dat. Doporučujeme důležitá data zálohovat.'
      },
      {
        title: 'Ukončení služby / účtu',
        text: 'Svůj účet můžete kdykoli zrušit e-mailem na adrese pavel@petslog.com. My můžeme službu nebo účet ukončit zejména při zneužití nebo z technických/organizačních důvodů.'
      },
      {
        title: 'Změny podmínek',
        text: 'Podmínky můžeme upravit. Aktuální znění bude vždy dostupné na této stránce; datum účinnosti bude uvedeno nahoře.'
      },
      {
        title: 'Právo a řešení sporů',
        text: 'Tyto podmínky se řídí právem České republiky. Případné spory budou řešeny příslušnými soudy v ČR.'
      }
    ]
  } : {
    back: 'Back to home',
    title: 'Terms of Use for Petslog',
    effectiveFrom: 'Effective from: March 1, 2026',
    sections: [
      {
        title: 'Operator',
        text: 'The operator of Petslog is Pavel Šimek (individual), ID No.: 21555401, contact: pavel@petslog.com.'
      },
      {
        title: 'Testing Mode (Beta)',
        text: 'The service is provided in testing mode. Features may change, be temporarily unavailable, or be discontinued. We may adjust settings and service structure to improve functionality.'
      },
      {
        title: 'Account and Registration',
        text: 'During registration, you must provide accurate information and protect your login credentials. You are responsible for activities under your account.'
      },
      {
        title: 'Usage Rules',
        text: 'You must not misuse the service (e.g., attempts to attack, bypass security, spam, uploading illegal content, disrupting operations). If you violate the rules, we may limit or revoke access to your account.'
      },
      {
        title: 'User Content and Data',
        text: 'If you enter content into Petslog (e.g., notes, animal information, photos), you declare that you have the right to use it. You grant us a non-exclusive right to process this content solely for the purpose of providing and improving the service.'
      },
      {
        title: 'Free Provision',
        text: 'Currently, the service is provided free of charge. In the future, we may introduce paid features or tariffs; any changes will be communicated in advance.'
      },
      {
        title: 'Health and Professional Information',
        text: 'If Petslog contains recommendations or care reminders, they are for informational purposes only and do not replace veterinary examination or professional care. In acute cases, always contact a veterinarian.'
      },
      {
        title: 'Availability and Limitation of Liability',
        text: 'We provide the service "as is". We do not guarantee uninterrupted availability or error-free operation. To the extent permitted by law, we are not liable for damages arising from using or being unable to use the service, including data loss. We recommend backing up important data.'
      },
      {
        title: 'Termination of Service / Account',
        text: 'You may cancel your account at any time by emailing pavel@petslog.com. We may terminate the service or account especially in cases of misuse or for technical/organizational reasons.'
      },
      {
        title: 'Changes to Terms',
        text: 'We may modify these terms. The current version will always be available on this page; the effective date will be indicated at the top.'
      },
      {
        title: 'Dispute Resolution',
        text: 'These terms are governed by the laws of the Czech Republic. Any disputes will be resolved by the appropriate courts in the Czech Republic.'
      }
    ]
  };

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
          <Link href={`/${locale}`}>
            <Button variant="outline" className="border-white/60 text-white hover:bg-white/10 bg-transparent">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {content.back}
            </Button>
          </Link>
        </header>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-8 space-y-6 text-teal-50">
          <h1 className="text-3xl font-bold text-white">{content.title}</h1>
          <p className="text-teal-200">{content.effectiveFrom}</p>

          <hr className="border-white/10" />

          {content.sections.map((section, index) => (
            <section key={index} className="space-y-4">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white/60 text-sm">
          <p>© 2026 Petslog. Všechna práva vyhrazena.</p>
        </div>
      </div>
    </div>
  );
}
