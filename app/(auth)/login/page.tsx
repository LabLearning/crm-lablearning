import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage({ searchParams }: { searchParams?: { suspendu?: string } }) {
  return <LoginForm suspendu={searchParams?.suspendu === '1'} />
}
