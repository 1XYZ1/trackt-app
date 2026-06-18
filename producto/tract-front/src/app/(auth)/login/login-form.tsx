'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z
    .string()
    .min(1, 'Ingresa tu correo electrónico')
    .email('Ingresa un correo válido'),
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: 'onTouched',
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
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2.5">
        <Label
          className="font-semibold text-[11px] text-neutral-400 uppercase tracking-[0.16em]"
          htmlFor="email"
        >
          Correo electrónico
        </Label>
        <div className="relative">
          <Mail
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors',
              errors.email && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={cn(
              'h-12 rounded-lg border-white/10 bg-[#111827]/72 pl-10 text-sm text-neutral-100 transition-colors placeholder:text-slate-500 focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/25',
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

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label
            className="font-semibold text-[11px] text-neutral-400 uppercase tracking-[0.16em]"
            htmlFor="password"
          >
            Contraseña
          </Label>
          <Link
            className="text-brand-300 text-xs transition hover:text-brand-200"
            href="/forgot-password"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <div className="relative">
          <Lock
            className={cn(
              'pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors',
              errors.password && 'text-destructive',
            )}
          />
          <Input
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className={cn(
              'h-12 rounded-lg border-white/10 bg-[#111827]/72 pr-10 pl-10 text-sm text-neutral-100 transition-colors placeholder:text-slate-500 focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/25',
              errors.password &&
                'border-destructive/60 focus-visible:border-destructive focus-visible:ring-destructive/20',
            )}
            id="password"
            placeholder="••••••••••"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
          />
          <button
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5" />
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        className="mt-3 h-12 w-full rounded-lg border-brand-primary/40 bg-brand-primary font-semibold text-sm text-white shadow-[0_18px_36px_rgba(97,82,232,0.32)] transition hover:bg-brand-400 disabled:shadow-none"
        loading={pending}
        type="submit"
      >
        <span>Iniciar sesión</span>
        <ArrowRight className="absolute right-5 size-4" />
      </Button>
    </form>
  );
}
