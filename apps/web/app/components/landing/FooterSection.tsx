import Link from 'next/link';

interface FooterSectionProps {
  locale: string;
}

const columns = [
  {
    title: 'Produkt',
    links: [
      { label: 'Funkce', href: '/cs/funkce' },
      { label: 'Ceník', href: '#pricing' },
      { label: 'Changelog', href: '/cs/changelog' },
    ],
  },
  {
    title: 'Firma',
    links: [
      { label: 'O nás', href: '#about' },
      { label: 'Kontakt', href: 'mailto:info@petslog.cz' },
      { label: 'Blog', href: '#' },
    ],
  },
  {
    title: 'Právní',
    links: [
      { label: 'Podmínky použití', href: '#' },
      { label: 'Ochrana soukromí (GDPR)', href: '#' },
    ],
  },
];

export function FooterSection({ locale }: FooterSectionProps) {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2 mb-4">
              <span className="text-xl font-bold text-white">🐾 Petslog</span>
            </Link>
            <p className="text-sm leading-relaxed">
              Správa útulku bez chaosu. Navrženo pro reálný provoz útulků v ČR.
            </p>
            <a
              href="mailto:info@petslog.cz"
              className="inline-block mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors"
            >
              info@petslog.cz
            </a>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© 2025 Petslog. Všechna práva vyhrazena.</p>
          <p className="text-xs">
            Vyrobeno s ❤️ v České republice
          </p>
        </div>
      </div>
    </footer>
  );
}
