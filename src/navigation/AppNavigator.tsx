import React from 'react';
import {StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ion from 'react-native-vector-icons/Ionicons';
import {DiscoverScreen} from '../screens/DiscoverScreen';
import {CookScreen} from '../screens/CookScreen';
import {SavedScreen} from '../screens/SavedScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {palette} from '../tokens';

const Tab = createBottomTabNavigator();

function IconWrap({active, children}: {active: boolean; children: React.ReactNode}) {
  return (
    <View style={[styles.iconWrap, active ? styles.iconWrapActive : styles.iconWrapInactive]}>
      {children}
    </View>
  );
}

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
      }}>

      <Tab.Screen
        name="home"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <IconWrap active={focused}>
              <Ion
                name={focused ? 'compass' : 'compass-outline'}
                size={22}
                color={focused ? '#fff' : 'rgba(44,26,14,0.4)'}
              />
            </IconWrap>
          ),
        }}
      />

      <Tab.Screen
        name="cook"
        component={CookScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <IconWrap active={focused}>
              <Ion
                name={focused ? 'flame' : 'flame-outline'}
                size={22}
                color={focused ? '#fff' : 'rgba(44,26,14,0.4)'}
              />
            </IconWrap>
          ),
        }}
      />

      <Tab.Screen
        name="saved"
        component={SavedScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <IconWrap active={focused}>
              <Ion
                name={focused ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={focused ? '#fff' : 'rgba(44,26,14,0.4)'}
              />
            </IconWrap>
          ),
        }}
      />

      <Tab.Screen
        name="profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <IconWrap active={focused}>
              <Ion
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={focused ? '#fff' : 'rgba(44,26,14,0.4)'}
              />
            </IconWrap>
          ),
        }}
      />

    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    height: 68,
    paddingTop: 10,
    paddingBottom: 10,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: palette.terracotta,
  },
  iconWrapInactive: {
    backgroundColor: 'rgba(44,26,14,0.07)',
  },
});