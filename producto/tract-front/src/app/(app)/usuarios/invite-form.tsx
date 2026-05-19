'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteUser } from '@/app/actions/users';

const schema = z.object({
  email: z.string().email('Correo invalido'),
  fullName: z.string().min(1, 'Requerido').max(120),
  role: z.enum(['admin', 'jefe_taller', 'mechanic']),
});

type FormValues = z.infer<typeof schema>;

export function InviteForm() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { type: 'ok' | 'err'; msg: string } | null
  >(null);

  const {
    register,
    handleSubmit,
    reset,
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
          <select
            id="role"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            {...register('role')}
          >
            <option value="mechanic">Mecánico</option>
            <option value="jefe_taller">Jefe de taller</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Invitar usuario'}
        </Button>
        {feedback && (
          <p
            className={
              feedback.type === 'ok'
                ? 'text-emerald-500 text-sm'
                : 'text-destructive text-sm'
            }
          >
            {feedback.msg}
          </p>
        )}
      </div>
    </form>
  );
}
