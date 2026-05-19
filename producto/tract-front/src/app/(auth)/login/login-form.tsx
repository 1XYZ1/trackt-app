'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { AlertCircle, Lock, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z
    .string()
    .min(1, 'Ingresa tu correo electronico')
    .email('Ingresa un correo valido'),
  password: z
    .string()
    .min(1, 'Ingresa tu contrasena')
    .min(6, 'La contrasena debe tener al menos 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', values.email);
      formData.set('password', values.password);
      await login(formData);
    });
  };

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="font-medium text-xs text-muted-foreground uppercase tracking-[0.14em]"
        >
          Correo electronico
        </Label>
        <div className="relative">
          <Mail
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors',
              errors.email && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={cn(
              'h-11 rounded-lg border-border/70 bg-background/70 pl-10 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/20',
              errors.email &&
                'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20',
            )}
            id="email"
            placeholder="tu@empresa.cl"
            type="email"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5" />
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="password"
            className="font-medium text-xs text-muted-foreground uppercase tracking-[0.14em]"
          >
            Contrasena
          </Label>
          <Link
            href="/forgot-password"
            className="text-cyan-300 text-xs transition hover:text-cyan-200"
          >
            Olvidaste tu contrasena?
          </Link>
        </div>
        <div className="relative">
          <Lock
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors',
              errors.password && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className={cn(
              'h-11 rounded-lg border-border/70 bg-background/70 pl-10 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/20',
              errors.password &&
                'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20',
            )}
            id="password"
            placeholder="********"
            type="password"
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5" />
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        className="mt-2 h-11 w-full rounded-lg border-cyan-400/40 bg-cyan-400/90 font-semibold text-sm text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:bg-cyan-300 disabled:shadow-none"
        disabled={!isValid || pending}
        loading={pending}
        type="submit"
      >
        {pending ? 'Iniciando sesion...' : 'Iniciar sesion'}
      </Button>
    </form>
  );
}
