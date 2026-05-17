'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPassword } from '@/app/actions/auth';

const schema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Las contrasenas no coinciden',
    path: ['passwordConfirm'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetForm() {
  const [pending, startTransition] = useTransition();
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
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="font-medium text-xs text-zinc-300 uppercase tracking-wide"
        >
          Nueva contrasena
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            className="h-11 rounded-lg border-white/10 bg-zinc-950/60 pl-10 text-sm text-white placeholder:text-zinc-600 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20"
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="text-red-400 text-xs">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="passwordConfirm"
          className="font-medium text-xs text-zinc-300 uppercase tracking-wide"
        >
          Confirmar contrasena
        </Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            placeholder="********"
            className="h-11 rounded-lg border-white/10 bg-zinc-950/60 pl-10 text-sm text-white placeholder:text-zinc-600 focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20"
            {...register('passwordConfirm')}
          />
        </div>
        {errors.passwordConfirm && (
          <p className="text-red-400 text-xs">
            {errors.passwordConfirm.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-sm text-white shadow-cyan-500/20 shadow-lg transition hover:from-cyan-400 hover:to-blue-500"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          'Actualizar contrasena'
        )}
      </Button>
    </form>
  );
}
