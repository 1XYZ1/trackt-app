'use client';

import { useState, useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { roleLabel } from '@/lib/auth/role-labels';
import { inviteUser } from '@/app/actions/users';

const schema = z.object({
  email: z.string().email('Correo invalido'),
  fullName: z.string().min(1, 'Requerido').max(120),
  role: z.enum(['admin', 'jefe_taller', 'jefe_inventario', 'mechanic']),
});

type FormValues = z.infer<typeof schema>;

const ROLE_OPTIONS: FormValues['role'][] = [
  'mechanic',
  'jefe_taller',
  'jefe_inventario',
  'admin',
];

export function InviteForm() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { type: 'ok' | 'err'; msg: string } | null
  >(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'mechanic' },
  });

  const onSubmit = (values: FormValues) => {
    setFeedback(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('email', values.email);
      fd.set('fullName', values.fullName);
      fd.set('role', values.role);
      const result = await inviteUser(fd);
      if (result.ok) {
        setFeedback({ type: 'ok', msg: 'Invitacion enviada' });
        reset({ email: '', fullName: '', role: 'mechanic' });
      } else {
        setFeedback({ type: 'err', msg: result.error });
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" placeholder="user@empresa.cl" {...register('email')} />
          {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre</Label>
          <Input id="fullName" placeholder="Juan Perez" {...register('fullName')} />
          {errors.fullName && <p className="text-destructive text-xs">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Rol</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                items={ROLE_OPTIONS.map((role) => ({
                  label: roleLabel(role),
                  value: role,
                }))}
                onValueChange={(value) => field.onChange(value)}
                value={field.value}
              >
                <SelectTrigger id="role" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          <UserPlus />
          Invitar usuario
        </Button>
        {feedback && (
          <p
            className={
              feedback.type === 'ok'
                ? 'flex items-center gap-1.5 text-sm text-success-foreground'
                : 'flex items-center gap-1.5 text-destructive text-sm'
            }
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {feedback.msg}
          </p>
        )}
      </div>
    </form>
  );
}
