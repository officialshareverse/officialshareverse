import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../auth/AuthProvider";
import { Compass, House, TicketPercent, UserRound, Wallet } from "../components/Icons";
import { colors } from "../theme/tokens";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SignupScreen from "../screens/auth/SignupScreen";
import CreateSplitScreen from "../screens/app/CreateSplitScreen";
import GroupDetailScreen from "../screens/app/GroupDetailScreen";
import HomeScreen from "../screens/app/HomeScreen";
import MarketplaceScreen from "../screens/app/MarketplaceScreen";
import MySplitDetailScreen from "../screens/app/MySplitDetailScreen";
import MySplitsScreen from "../screens/app/MySplitsScreen";
import ProfileScreen from "../screens/app/ProfileScreen";
import ReferralScreen from "../screens/app/ReferralScreen";
import WalletScreen from "../screens/app/WalletScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconProps = { color, size, strokeWidth: 2.1 };
          if (route.name === "HomeTab") return <House {...iconProps} />;
          if (route.name === "MarketplaceTab") return <Compass {...iconProps} />;
          if (route.name === "WalletTab") return <Wallet {...iconProps} />;
          return <UserRound {...iconProps} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: "Home" }} />
      <Tab.Screen
        name="MarketplaceTab"
        component={MarketplaceScreen}
        options={{ title: "Groups" }}
      />
      <Tab.Screen name="WalletTab" component={WalletScreen} options={{ title: "Wallet" }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.night,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CreateSplit" component={CreateSplitScreen} options={{ title: "Create split" }} />
      <Stack.Screen name="MySplits" component={MySplitsScreen} options={{ title: "My splits" }} />
      <Stack.Screen name="MySplitDetail" component={MySplitDetailScreen} options={{ title: "Split details" }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: "Group" }} />
      <Stack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          title: "Refer and earn",
          headerRight: () => <TicketPercent color={colors.primary} size={18} strokeWidth={2.1} />,
        }}
      />
    </Stack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.splashText}>Loading ShareVerse</Text>
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.background,
  },
  splashText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  tabBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
});
