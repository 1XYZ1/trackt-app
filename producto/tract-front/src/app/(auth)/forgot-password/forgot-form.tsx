'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/app/actions/auth';

const schema = z.object({
  email: z
    .string()
    .min(1, 'Ingresa tu correo electrónico')
    .email('Ingresa un correo válido'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', values.email);
      await forgotPassword(formData);
    });
  };

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="font-semibold text-[11px] text-neutral-400 uppercase tracking-[0.16em]"
        >
          Correo electrónico
        </Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            autoComplete="email"
            className="h-11 rounded-lg border-white/10 bg-neutral-950/70 pl-10 text-sm text-neutral-100 transition-colors placeholder:text-neutral-600 focus-visible:border-brand-primary/70 focus-visible:ring-brand-primary/25"
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

      <Button
        className="h-11 w-full rounded-lg border-brand-primary/40 bg-brand-primary font-semibold text-sm text-white shadow-[0_16px_34px_rgba(97,82,232,0.26)] transition hover:bg-brand-400 disabled:shadow-none"
        disabled={pending}
        loading={pending}
        type="submit"
      >
        Enviar enlace
      </Button>
    </form>
  );
}
