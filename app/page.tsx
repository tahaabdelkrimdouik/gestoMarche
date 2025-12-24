import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to stock page as default
  redirect('/stock');
}