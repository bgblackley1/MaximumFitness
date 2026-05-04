import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'active' | 'inactive' | 'pending' | 'danger';
}

export default function Badge({ label, variant = 'active' }: BadgeProps) {
  const bgColor = {
    active: colors.black,
    inactive: colors.gray200,
    pending: colors.gray300,
    danger: colors.red500,
  }[variant];

  const textColor = {
    active: colors.white,
    inactive: colors.gray600,
    pending: colors.gray700,
    danger: colors.white,
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});