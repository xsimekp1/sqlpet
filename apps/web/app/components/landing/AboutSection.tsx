export function AboutSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
              Jak to začalo
            </h2>

            <div className="space-y-5 text-gray-600 leading-relaxed">
              <p>
                Jednoho večera jsme našli kočku v lese. Zraněnou, vystrašenou.
                Zkusili jsme ji najít přes útulky — žádná evidence online, žádný
                systém. Jen telefonáty a štěstí.
              </p>
              <p>
                Proto vznikl Petslog. Věříme, že každý útulek — ať malý obecní
                nebo velká organizace — si zaslouží nástroj, který šetří čas a
                zlepšuje péči. Aby se na ta zvířata nezapomnělo.
              </p>
              <p>
                Jsme malý tým z Česka. Budujeme to, co bychom tehdy sami
                potřebovali. Vede nás Pavel.
              </p>
            </div>
          </div>

          {/* Illustration placeholder */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Decorative circles */}
              <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-teal-50 flex items-center justify-center">
                <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-teal-100 flex items-center justify-center">
                  <div className="text-8xl select-none" aria-hidden="true">🐾</div>
                </div>
              </div>
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-md px-3 py-2 border border-gray-100">
                <span className="text-xs font-medium text-gray-700">❤️ 100% česky</span>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-md px-3 py-2 border border-gray-100">
                <span className="text-xs font-medium text-gray-700">🛡️ GDPR ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
