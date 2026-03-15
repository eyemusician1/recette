import React from 'react';
import {View, StyleSheet} from 'react-native';

type IconProps = {
  color: string;
  size?: number;
};

export function HomeIcon({color, size = 22}: IconProps) {
  const s = size;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      {/* Roof */}
      <View style={[styles.roof, {borderBottomColor: color, borderBottomWidth: s * 0.045}]} />
      {/* Walls */}
      <View style={[styles.walls, {borderColor: color, borderWidth: s * 0.045, borderTopWidth: 0}]} />
      {/* Door */}
      <View style={[styles.door, {borderColor: color, borderWidth: s * 0.045, borderBottomWidth: 0}]} />
    </View>
  );
}

export function CookIcon({color, size = 22}: IconProps) {
  const s = size;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      {/* Chef hat brim */}
      <View style={[styles.hatBrim, {borderColor: color, borderWidth: s * 0.045, width: s * 0.75, height: s * 0.18, borderRadius: s * 0.05}]} />
      {/* Hat top */}
      <View style={[styles.hatTop, {borderColor: color, borderWidth: s * 0.045, width: s * 0.5, height: s * 0.45, borderRadius: s * 0.25, borderBottomWidth: 0, bottom: s * 0.18}]} />
    </View>
  );
}

export function SavedIcon({color, size = 22}: IconProps) {
  const s = size;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      <View style={[styles.bookmarkOuter, {borderColor: color, borderWidth: s * 0.045, width: s * 0.55, height: s * 0.78, borderRadius: s * 0.06, borderBottomWidth: 0}]} />
      <View style={[styles.bookmarkNotch, {borderTopColor: color, borderTopWidth: s * 0.28, borderLeftWidth: s * 0.275, borderRightWidth: s * 0.275, width: s * 0.55, bottom: s * 0.11}]} />
    </View>
  );
}

export function ProfileIcon({color, size = 22}: IconProps) {
  const s = size;
  return (
    <View style={{width: s, height: s, alignItems: 'center', justifyContent: 'center'}}>
      {/* Head */}
      <View style={[styles.head, {borderColor: color, borderWidth: s * 0.045, width: s * 0.38, height: s * 0.38, borderRadius: s * 0.19, top: s * 0.04}]} />
      {/* Shoulders arc */}
      <View style={[styles.shoulders, {borderColor: color, borderWidth: s * 0.045, borderBottomWidth: 0, borderTopLeftRadius: s * 0.38, borderTopRightRadius: s * 0.38, width: s * 0.68, height: s * 0.3, bottom: s * 0.02}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Home
  roof: {
    position: 'absolute',
    top: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  walls: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 9,
    borderRadius: 1,
  },
  door: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 6,
    borderRadius: 2,
  },
  // Cook
  hatBrim: {
    position: 'absolute',
    bottom: 3,
  },
  hatTop: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  // Saved
  bookmarkOuter: {
    position: 'absolute',
    top: 2,
    backgroundColor: 'transparent',
  },
  bookmarkNotch: {
    position: 'absolute',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    backgroundColor: 'transparent',
  },
  // Profile
  head: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  shoulders: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
});