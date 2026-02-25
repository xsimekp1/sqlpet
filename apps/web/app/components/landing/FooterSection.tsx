import Link from 'next/link';

interface FooterSectionProps {
  locale: string;
}

export function FooterSection({ locale }: FooterSectionProps) {
  const columns = [
    {
      title: 'Produkt',
      links: [
        { label: 'Funkce', href: `/${locale}/funkce` },
        { label: 'Ceník', href: '#pricing' },
        { label: 'Changelog', href: `/${locale}/changelog` },
      ],
    },
    {
      title: 'Blog',
      links: [
        { label: '15 Founders - Sara Polak', href: '#' },
      ],
    },
    {
      title: 'Firma',
      links: [
        { label: 'O nás', href: '#about' },
      ],
    },
    {
      title: 'Právní',
      links: [
        { label: 'Podmínky užití', href: `/${locale}/podminky-uziti` },
        { label: 'Ochrana soukromí (GDPR)', href: `/${locale}/gdpr` },
      ],
    },
  ];
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Blog post */}
        <div className="mb-12 p-6 bg-gray-800/50 rounded-2xl border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-teal-400 uppercase tracking-wide">Blog</span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-500">25. února 2026</span>
          </div>
          <h3 className="text-white font-semibold text-lg mb-3">
            Dneska máme takový malý milník: přihlásili jsme náš projekt do výběru Sary Polak –{" "}
            <a 
              href="https://www.instagram.com/_sara_polak/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-400 hover:text-teal-300 underline"
            >
              15 Founders. One New Renaissance.
            </a>
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            Je to iniciativa, která v březnu a dubnu vezme patnáctku lidí, co staví věci mimo vyjeté koleje — a pomůže jim to dotáhnout do veřejného launche a postavit kolem toho komunitu. Ne jako další akcelerátor, spíš jako "atelier": méně šablon, víc rukou na díle.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed mb-3">
            A teď je to jednoduché: uvidíme, jestli se dostaneme mezi 15 postupujících. Držte palce. 🙂
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Jestli to klapne, budeme to celé stavět víc veřejně než doteď — jakmile budu moct, nasdílím víc detailů.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href={`/${locale}`} className="flex items-center gap-2 mb-4">
              <span className="text-xl font-bold text-white">🐾 Petslog</span>
            </Link>
            <p className="text-sm leading-relaxed">
              Správa zvířat bez chaosu. Navrženo pro reálný provoz v ČR.
            </p>
            <span className="inline-block mt-3 text-sm text-teal-400">
              Mailovou službu teprve zařizujeme
            </span>
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
