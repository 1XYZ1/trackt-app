'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/app/actions/auth';

const schema = z
  .object({
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetForm() {
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('password', values.password);
      formData.set('passwordConfirm', values.passwordConfirm);
      await resetPassword(formData);
    });
  };

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label
          htmlFor="password"
          className="font-semibold text-[11px] text-neutral-400 uppercase tracking-[0.16em]"
        >
          Nueva contraseña
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            autoComplete="new-password"
            className="h-11 rounded-lg border-white/10 bg-neutral-950/70 pr-10 pl-10 text-sm text-neutral-100 transition-colors placeholder:text-neutral-600 focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/25"
            id="password"
            placeholder="********"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
          />
          <button
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
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

      <div className="space-y-2">
        <Label
          htmlFor="passwordConfirm"
          className="font-semibold text-[11px] text-neutral-400 uppercase tracking-[0.16em]"
        >
          Confirmar contraseña
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            autoComplete="new-password"
            className="h-11 rounded-lg border-white/10 bg-neutral-950/70 pr-10 pl-10 text-sm text-neutral-100 transition-colors placeholder:text-neutral-600 focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/25"
            id="passwordConfirm"
            placeholder="********"
            type={showConfirm ? 'text' : 'password'}
            {...register('passwordConfirm')}
          />
          <button
            aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
            onClick={() => setShowConfirm((value) => !value)}
            type="button"
          >
            {showConfirm ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {errors.passwordConfirm && (
          <p className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertCircle className="size-3.5" />
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      <Button
        className="h-11 w-full rounded-lg border-brand-primary/40 bg-brand-primary font-semibold text-sm text-white shadow-[0_16px_34px_rgba(97,82,232,0.26)] transition hover:bg-brand-400 disabled:shadow-none"
        disabled={pending}
        loading={pending}
        type="submit"
      >
        Actualizar contraseña
      </Button>
    </form>
  );
}
