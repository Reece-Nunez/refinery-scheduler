import { redirect } from 'next/navigation'

export default async function Home() {
  // Since database is deleted, redirect directly to operators page
  redirect('/operators')
}
