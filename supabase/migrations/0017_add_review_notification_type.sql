-- Add notification type for new reviews
SET client_encoding = 'UTF8';

INSERT INTO public.notification_types (key, category, severity, title_template, body_template, default_channels)
VALUES (
    'business.new_review',
    'review',
    'info',
    'У вас новый отзыв',
    'Пользователь оставил отзыв с рейтингом {{rating}} из 5.',
    ARRAY['in_app', 'email']
)
ON CONFLICT (key) DO NOTHING;

