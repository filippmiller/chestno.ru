import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, X, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { submitUpgradeRequest } from '@/api/organizationsService';
import type { StatusLevel } from '@/types/organizations';

// Validation schema
const upgradeRequestSchema = z.object({
  target_level: z.enum(['B', 'C'], {
    required_error: 'Пожалуйста, выберите целевой уровень',
  }),
  message: z
    .string()
    .min(10, 'Сообщение должно содержать минимум 10 символов')
    .max(500, 'Сообщение должно содержать максимум 500 символов'),
  evidence_urls: z.array(z.string().url('Неверный формат URL')).optional(),
  accept_terms: z.boolean().refine((val) => val === true, {
    message: 'Необходимо принять условия',
  }),
});

type UpgradeRequestFormData = z.infer<typeof upgradeRequestSchema>;

interface UpgradeRequestFormProps {
  organizationId: string;
  currentLevel: StatusLevel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const UpgradeRequestForm: React.FC<UpgradeRequestFormProps> = ({
  organizationId,
  currentLevel,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpgradeRequestFormData>({
    resolver: zodResolver(upgradeRequestSchema),
    defaultValues: {
      target_level: undefined,
      message: '',
      evidence_urls: [],
      accept_terms: false,
    },
  });

  const targetLevel = watch('target_level');
  const message = watch('message');
  const acceptTerms = watch('accept_terms');

  // Handle adding evidence URL field
  const addEvidenceUrl = () => {
    setEvidenceUrls([...evidenceUrls, '']);
  };

  // Handle removing evidence URL field
  const removeEvidenceUrl = (index: number) => {
    const updated = evidenceUrls.filter((_, i) => i !== index);
    setEvidenceUrls(updated);
    setValue('evidence_urls', updated.filter((url) => url.trim() !== ''));
  };

  // Handle evidence URL change
  const handleEvidenceUrlChange = (index: number, value: string) => {
    const updated = [...evidenceUrls];
    updated[index] = value;
    setEvidenceUrls(updated);
    // Update form value with non-empty URLs
    setValue(
      'evidence_urls',
      updated.filter((url) => url.trim() !== '')
    );
  };

  // Handle form submission
  const onSubmit = async (data: UpgradeRequestFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Filter out empty evidence URLs
      const filteredUrls = data.evidence_urls?.filter((url) => url.trim() !== '') || [];

      const payload = {
        target_level: data.target_level,
        message: data.message,
        evidence_urls: filteredUrls.length > 0 ? filteredUrls : undefined,
        accept_terms: data.accept_terms,
      };

      await submitUpgradeRequest(organizationId, payload);

      // Success state
      setSubmitSuccess(true);

      // Reset form after 2 seconds and close
      setTimeout(() => {
        reset();
        setEvidenceUrls(['']);
        setSubmitSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting upgrade request:', error);

      // Handle specific error cases
      if (error.response?.status === 429) {
        setSubmitError('Вы можете подать запрос раз в 30 дней. Пожалуйста, попробуйте позже.');
      } else if (error.response?.status === 400) {
        setSubmitError(
          error.response.data?.message || 'Неверные данные запроса. Проверьте заполненные поля.'
        );
      } else if (error.response?.status === 403) {
        setSubmitError(
          'Для запроса уровня C необходимо иметь активный уровень B. Сначала получите уровень B.'
        );
      } else {
        setSubmitError('Ошибка отправки запроса. Пожалуйста, попробуйте позже.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close
  const handleClose = (open: boolean) => {
    if (!isSubmitting && !submitSuccess) {
      onOpenChange(open);
      if (!open) {
        // Reset form when closing
        reset();
        setEvidenceUrls(['']);
        setSubmitError(null);
      }
    }
  };

  // Character count for message
  const messageLength = message?.length || 0;
  const messageCountColor = messageLength > 500 ? 'text-red-500' : 'text-gray-500';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Запрос повышения уровня статуса</DialogTitle>
          <DialogDescription>
            Заполните форму для запроса повышения статуса вашей организации. Мы рассмотрим ваш
            запрос в течение 3-5 рабочих дней.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-700">Запрос успешно отправлен!</h3>
              <p className="text-sm text-gray-600 mt-2">
                Мы рассмотрим ваш запрос в течение 3-5 рабочих дней и свяжемся с вами.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Level Info */}
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                Текущий уровень: <span className="font-semibold">Уровень {currentLevel}</span>
              </p>
            </div>

            {/* Target Level Selection */}
            <div className="space-y-2">
              <Label htmlFor="target_level">
                Целевой уровень <span className="text-red-500">*</span>
              </Label>
              <Select
                value={targetLevel}
                onValueChange={(value) => setValue('target_level', value as 'B' | 'C')}
              >
                <SelectTrigger id="target_level">
                  <SelectValue placeholder="Выберите целевой уровень" />
                </SelectTrigger>
                <SelectContent>
                  {currentLevel === 'A' && (
                    <>
                      <SelectItem value="B">Уровень B - Верифицированная организация</SelectItem>
                      <SelectItem value="C" disabled>
                        Уровень C (требуется уровень B)
                      </SelectItem>
                    </>
                  )}
                  {currentLevel === 'B' && (
                    <SelectItem value="C">
                      Уровень C - Премиум организация с расширенными возможностями
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.target_level && (
                <p className="text-sm text-red-500">{errors.target_level.message}</p>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">
                Сообщение <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="message"
                placeholder="Расскажите, почему вы хотите повысить статус организации (10-500 символов)"
                rows={6}
                {...register('message')}
                className={errors.message ? 'border-red-500' : ''}
              />
              <div className="flex justify-between items-center">
                {errors.message ? (
                  <p className="text-sm text-red-500">{errors.message.message}</p>
                ) : (
                  <div />
                )}
                <p className={`text-sm ${messageCountColor}`}>{messageLength}/500</p>
              </div>
            </div>

            {/* Evidence URLs */}
            <div className="space-y-2">
              <Label>Ссылки на подтверждающие материалы (необязательно)</Label>
              <p className="text-xs text-gray-500">
                Добавьте ссылки на документы, сертификаты или другие материалы, подтверждающие ваш
                запрос
              </p>
              <div className="space-y-2">
                {evidenceUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://example.com/document"
                      value={url}
                      onChange={(e) => handleEvidenceUrlChange(index, e.target.value)}
                      className="flex-1"
                    />
                    {evidenceUrls.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeEvidenceUrl(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {errors.evidence_urls && (
                <p className="text-sm text-red-500">{errors.evidence_urls.message}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEvidenceUrl}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить ссылку
              </Button>
            </div>

            {/* Terms Acceptance */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="accept_terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setValue('accept_terms', checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="accept_terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Я принимаю условия <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-gray-500">
                  Подтверждаю, что предоставленная информация является достоверной и согласен с
                  условиями рассмотрения запроса
                </p>
              </div>
            </div>
            {errors.accept_terms && (
              <p className="text-sm text-red-500">{errors.accept_terms.message}</p>
            )}

            {/* Error Display */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  'Отправить запрос'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
