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
    formState: { errors, isValid },
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

      <Button
        className="h-11 w-full rounded-lg font-semibold text-sm"
        disabled={!isValid || pending}
        loading={pending}
        type="submit"
      >
        {pending ? 'Enviando enlace...' : 'Enviar enlace'}
      </Button>
    </form>
  );
}
