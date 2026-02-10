import { redirect } from 'next/navigation';

export default function LocaleRoot() {
  // Redirect to login page
  redirect('/login');
}
