import React from 'react';
import {Pressable, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ion from 'react-native-vector-icons/Ionicons';
import {DiscoverScreen} from '../screens/DiscoverScreen';
import {CookScreen} from '../screens/CookScreen';
import {SavedScreen} from '../screens/SavedScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {palette} from '../tokens';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
        tabBarButton: props => {
          const pressableProps = props as any;
          return <Pressable {...pressableProps} android_ripple={{color: 'transparent'}} />;
        },
      }}>

      <Tab.Screen
        name="home"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <Ion
              name={focused ? 'home' : 'home-outline'}
              size={23}
              color={focused ? palette.terracotta : palette.muted}
            />
          ),
        }}
      />

      <Tab.Screen
        name="cook"
        component={CookScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <Ion
              name={focused ? 'restaurant' : 'restaurant-outline'}
              size={23}
              color={focused ? palette.terracotta : palette.muted}
            />
          ),
        }}
      />

      <Tab.Screen
        name="saved"
        component={SavedScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <Ion
              name={focused ? 'bookmark' : 'bookmark-outline'}
              size={23}
              color={focused ? palette.terracotta : palette.muted}
            />
          ),
        }}
      />

      <Tab.Screen
        name="profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({focused}) => (
            <Ion
              name={focused ? 'person' : 'person-outline'}
              size={23}
              color={focused ? palette.terracotta : palette.muted}
            />
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
});