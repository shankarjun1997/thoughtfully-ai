-- Records how presence/liveness was checked before the consent photo was sent.
-- Either an on-device face + blink check or the explicit manual fallback.
-- No biometric template or face identifier is stored.

alter table public.session_verifications
  add column if not exists liveness_method text not null default 'manual_fallback';

alter table public.session_verifications
  drop constraint if exists session_verifications_liveness_method_check;

alter table public.session_verifications
  add constraint session_verifications_liveness_method_check
  check (liveness_method in ('face_blink', 'manual_fallback'));
