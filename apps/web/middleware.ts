import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['cs', 'en', 'sk'],
  defaultLocale: 'cs'
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
