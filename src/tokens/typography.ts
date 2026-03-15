export const typography = {
  serif: 'PlayfairDisplay-BoldItalic',
  cormorant: 'CormorantGaramond-Light',
  cormorantItalic: 'CormorantGaramond-Light',  // same file until LightItalic is added
  imFell: 'IMFellEnglish-Italic',
  fallback: 'Georgia',

  size: {
    xs: 12,
    sm: 13,
    md: 15,
    lg: 16,
    xl: 20,
    wordmark: 80,
  },

  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1.5,
    xwide: 3,
    eyebrow: 3.5,
  },

  lineHeight: {
    tight: 1,
    normal: 1.4,
    relaxed: 1.65,
  },
} as const;