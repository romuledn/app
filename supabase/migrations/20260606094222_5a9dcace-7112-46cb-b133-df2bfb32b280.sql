ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS doc_design jsonb NOT NULL DEFAULT jsonb_build_object(
    'template', 'classic',
    'accentColor', '#E63946',
    'inkColor', '#161C32',
    'displayFont', 'Bricolage Grotesque',
    'bodyFont', 'Inter',
    'logoPosition', 'left',
    'showWatermark', true,
    'showFooterBand', true
  );