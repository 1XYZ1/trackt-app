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
    <form
      className="mx-auto w-full max-w-[360px] space-y-4"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="block text-center font-medium text-xs text-zinc-500 uppercase tracking-[0.14em]"
        >
          Correo electronico
        </Label>
        <div className="relative">
          <Mail
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors',
              errors.email && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={cn(
              'h-11 rounded-lg border-zinc-700/70 bg-[#222222] pl-10 text-sm text-zinc-200 transition-colors placeholder:text-zinc-600 focus-visible:border-zinc-500 focus-visible:ring-zinc-600/20',
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
        <div className="space-y-1 text-center">
          <Label
            htmlFor="password"
            className="block font-medium text-xs text-zinc-500 uppercase tracking-[0.14em]"
          >
            Contrasena
          </Label>
          <Link
            href="/forgot-password"
            className="inline-flex text-orange-300/90 text-xs transition hover:text-orange-200"
          >
            Olvidaste tu contrasena?
          </Link>
        </div>
        <div className="relative">
          <Lock
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500 transition-colors',
              errors.password && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className={cn(
              'h-11 rounded-lg border-zinc-700/70 bg-[#222222] pl-10 text-sm text-zinc-200 transition-colors placeholder:text-zinc-600 focus-visible:border-zinc-500 focus-visible:ring-zinc-600/20',
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
        className="mt-2 h-11 w-full rounded-lg border border-zinc-600/70 bg-zinc-700 font-semibold text-sm text-zinc-100 transition hover:bg-zinc-600 disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
        disabled={!isValid || pending}
        loading={pending}
        type="submit"
      >
        {pending ? 'Iniciando sesion...' : 'Iniciar sesion'}
      </Button>
    </form>
  );
}
