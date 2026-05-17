'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Loader2, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile, uploadAvatar } from '@/app/actions/profile';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Requerido').max(120, 'Maximo 120'),
});

type FormValues = z.infer<typeof schema>;

type Feedback = { type: 'ok' | 'err'; msg: string } | null;

type Props = {
  userId: string;
  initialFullName: string;
  initialAvatarUrl: string | null;
};

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

function initials(name: string, fallback: string) {
  const base = name.trim() || fallback;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function PerfilForm({
  userId,
  initialFullName,
  initialAvatarUrl,
}: Props) {
  const [namePending, startNameTransition] = useTransition();
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null);

  const [avatarPending, startAvatarTransition] = useTransition();
  const [avatarFeedback, setAvatarFeedback] = useState<Feedback>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: initialFullName },
  });

  const watchedName = watch('fullName');

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onSubmitName = (values: FormValues) => {
    setNameFeedback(null);
    startNameTransition(async () => {
      const fd = new FormData();
      fd.set('fullName', values.fullName);
      const result = await updateProfile(fd);
      if (result.ok) {
        setNameFeedback({ type: 'ok', msg: 'Nombre actualizado' });
      } else {
        setNameFeedback({ type: 'err', msg: result.error });
      }
    });
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    setAvatarFeedback(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setLocalError('Formato no permitido (PNG, JPG o WEBP)');
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError('El archivo supera 2 MB');
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    setSelectedFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const onSubmitAvatar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;
    setAvatarFeedback(null);
    startAvatarTransition(async () => {
      const fd = new FormData();
      fd.set('avatar', selectedFile);
      const result = await uploadAvatar(fd);
      if (result.ok) {
        setAvatarUrl(result.url);
        setAvatarFeedback({ type: 'ok', msg: 'Avatar actualizado' });
        setSelectedFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setAvatarFeedback({ type: 'err', msg: result.error });
      }
    });
  };

  const displayedAvatar = preview ?? avatarUrl;

  return (
    <div className="space-y-8">
      <form
        className="space-y-4"
        onSubmit={handleSubmit(onSubmitName)}
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            placeholder="Tu nombre"
            autoComplete="name"
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="text-destructive text-xs">{errors.fullName.message}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={namePending}>
            {namePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Guardar nombre'
            )}
          </Button>
          {nameFeedback && (
            <p
              className={
                nameFeedback.type === 'ok'
                  ? 'text-emerald-500 text-sm'
                  : 'text-destructive text-sm'
              }
            >
              {nameFeedback.msg}
            </p>
          )}
        </div>
      </form>

      <div className="border-t pt-6">
        <div className="mb-3">
          <p className="font-medium text-sm">Foto de perfil</p>
          <p className="text-muted-foreground text-xs">
            PNG, JPG o WEBP. Maximo 2 MB.
          </p>
        </div>

        <form onSubmit={onSubmitAvatar} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              {displayedAvatar && (
                <AvatarImage
                  src={displayedAvatar}
                  alt={watchedName || initialFullName || 'Avatar'}
                />
              )}
              <AvatarFallback>
                {initials(watchedName || initialFullName, userId)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onFileChange}
                className="hidden"
                id="avatar-file"
              />
              <label
                htmlFor="avatar-file"
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <Camera className="size-4" />
                {selectedFile ? 'Cambiar archivo' : 'Seleccionar imagen'}
              </label>
              {selectedFile && (
                <p className="text-muted-foreground text-xs">
                  {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          {localError && (
            <p className="text-destructive text-xs">{localError}</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!selectedFile || avatarPending}
              variant="default"
            >
              {avatarPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Subir avatar
                </>
              )}
            </Button>
            {avatarFeedback && (
              <p
                className={
                  avatarFeedback.type === 'ok'
                    ? 'text-emerald-500 text-sm'
                    : 'text-destructive text-sm'
                }
              >
                {avatarFeedback.msg}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
