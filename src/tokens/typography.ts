export const typography = {
  // Keeping your original keys so we don't have to rewrite the screen files!

  // Headings & Titles: A sturdy, readable screen serif
  serif: 'Lora-Bold',

  // Body text & UI: A clean, highly legible sans-serif
  cormorant: 'Inter-Regular',

  // Italic body text
  cormorantItalic: 'Inter-Italic',

  // Accents / Buttons (Replacing the highly stylized IM Fell)
  imFell: 'Inter-Medium',

  fallback: 'System',

  size: {
    xs: 14,
    sm: 15,
    md: 17,
    lg: 19,
    xl: 24,
    wordmark: 80,
  },

  letterSpacing: {
    // I slightly adjusted these to work better with Inter/Lora
    tight: -0.3,
    normal: 0,
    wide: 0.5,
    xwide: 1.5,
    eyebrow: 2,
  },

  lineHeight: {
    tight: 1,
    normal: 1.4,
    relaxed: 1.65,
  },
} as const;