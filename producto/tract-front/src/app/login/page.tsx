import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, signup } from '../actions/auth';

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Trackt</CardTitle>
          <CardDescription>
            Inicia sesión o crea una cuenta para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••"
                required
                minLength={6}
              />
            </div>
            <div className="flex gap-2">
              <Button formAction={login} className="flex-1">
                Login
              </Button>
              <Button formAction={signup} variant="outline" className="flex-1">
                Signup
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
