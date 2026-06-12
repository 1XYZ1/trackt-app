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
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z
    .string()
    .min(1, 'Ingresa tu correo electronico')
    .email('Ingresa un correo valido'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotForm() {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', values.email);
      await forgotPassword(formData);
    });
  };

  return (
    <form
      className="mx-auto w-full max-w-[270px] space-y-3.5 text-left"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="block font-medium text-[10px] text-zinc-500"
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
              'h-9 rounded-md border border-white/10 bg-[#232527] px-3 pl-9 text-xs leading-normal text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors placeholder:text-zinc-600 focus-visible:border-cyan-500/70 focus-visible:ring-cyan-500/20',
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

      <Button
        className="mt-4 h-9 w-full rounded-md border border-white bg-white font-semibold text-xs text-black shadow-[0_10px_24px_rgba(255,255,255,0.12)] transition hover:bg-zinc-200 focus-visible:ring-white/30 disabled:border-zinc-700 disabled:bg-zinc-800 disabled:shadow-none"
        loading={pending}
        type="submit"
      >
        Enviar enlace
      </Button>
    </form>
  );
}
