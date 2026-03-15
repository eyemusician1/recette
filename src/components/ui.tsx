import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {palette, spacing, radius, typography} from '../tokens';

type SurfaceCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

type StatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
};

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  action?: string;
};

type ProgressBarProps = {
  value: number;
};

type TabBarItem = {
  key: string;
  label: string;
  shortLabel: string;
};

type BottomTabBarProps = {
  items: TabBarItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const toneMap: Record<BadgeTone, {bg: string; fg: string}> = {
  primary: {bg: palette.gold,       fg: palette.mahogany},
  success: {bg: '#1e3a1e',          fg: '#7ecb7e'},
  warning: {bg: '#3a2e10',          fg: palette.gold},
  danger:  {bg: '#3a1010',          fg: '#e87070'},
  neutral: {bg: palette.fog,        fg: palette.ochre},
};

export function SurfaceCard({children, style}: SurfaceCardProps): React.JSX.Element {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

export function PrimaryButton({label, onPress, style}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.primaryButton, pressed && styles.buttonPressed, style]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({label, onPress, style}: ButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.secondaryButton, pressed && styles.buttonPressed, style]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({tone = 'neutral', label}: StatusBadgeProps): React.JSX.Element {
  const config = toneMap[tone];
  return (
    <View style={[styles.badge, {backgroundColor: config.bg}]}>
      <Text style={[styles.badgeText, {color: config.fg}]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({eyebrow, title, action}: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function ProgressBar({value}: ProgressBarProps): React.JSX.Element {
  const clampedWidth = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: clampedWidth}]} />
    </View>
  );
}

export function StatTile({
  label,
  value,
  meta,
  style,
}: {
  label: string;
  value: string;
  meta: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <SurfaceCard style={[styles.statTile, style]}>
      <Text style={styles.microLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.subLabel}>{meta}</Text>
    </SurfaceCard>
  );
}

export function ListRow({
  title,
  subtitle,
  trailing,
  style,
}: {
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.listRow, style]}>
      <View style={styles.monogram}>
        <Text style={styles.monogramText}>{title.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.listRowCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.subLabel}>{subtitle}</Text>
      </View>
      {trailing}
    </View>
  );
}

export function BottomTabBar({items, activeKey, onChange}: BottomTabBarProps): React.JSX.Element {
  return (
    <View style={styles.tabBar}>
      {items.map(item => {
        const active = item.key === activeKey;
        return (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({pressed}) => [
              styles.tabItem,
              active && styles.tabItemActive,
              pressed && styles.tabItemPressed,
            ]}>
            <View style={[styles.tabIcon, active && styles.tabIconActive]}>
              <Text style={[styles.tabIconText, active && styles.tabIconTextActive]}>
                {item.shortLabel}
              </Text>
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const sharedText: Record<string, TextStyle> = {
  cardTitle: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.md,
    color: palette.parchment,
    fontWeight: '500',
  },
  subLabel: {
    fontFamily: typography.cormorantItalic,
    fontSize: typography.size.xs,
    color: palette.ochre,
  },
  microLabel: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.xs,
    color: palette.stone,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: typography.serif,
    fontSize: typography.size.xl,
    color: palette.parchment,
    fontWeight: '700',
  },
};

const styles = StyleSheet.create({
  surfaceCard: {
    backgroundColor: palette.ember,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.fog,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 10},
    elevation: 3,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: palette.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.md,
    letterSpacing: 1.2,
    color: palette.mahogany,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    fontFamily: typography.cormorantItalic,
    fontSize: typography.size.md,
    letterSpacing: 1.2,
    color: palette.amber,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{scale: 0.99}],
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  badgeText: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.xs,
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sectionEyebrow: {
    fontFamily: typography.cormorantItalic,
    fontSize: typography.size.xs,
    color: palette.stone,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.serif,
    fontSize: typography.size.xl,
    color: palette.parchment,
  },
  sectionAction: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.xs,
    color: palette.gold,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    backgroundColor: palette.fog,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  monogram: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.md,
    color: palette.parchment,
    fontWeight: '500',
  },
  listRowCopy: {
    flex: 1,
    gap: 2,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: palette.bistro,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.fog,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: -6},
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  tabItemActive: {
    backgroundColor: palette.fog,
  },
  tabItemPressed: {
    opacity: 0.82,
  },
  tabIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: palette.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: palette.rust,
  },
  tabIconText: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.xs,
    color: palette.stone,
  },
  tabIconTextActive: {
    color: palette.parchment,
  },
  tabLabel: {
    fontFamily: typography.cormorant,
    fontSize: typography.size.xs,
    color: palette.stone,
  },
  tabLabelActive: {
    color: palette.parchment,
  },
  cardTitle: sharedText.cardTitle,
  subLabel: sharedText.subLabel,
  microLabel: sharedText.microLabel,
  statValue: sharedText.statValue,
});