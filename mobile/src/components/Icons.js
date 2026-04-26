import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

function featherIcon(name) {
  return function FeatherIcon({ color, size, ...props }) {
    return <Feather name={name} color={color} size={size} {...props} />;
  };
}

function ionicon(name) {
  return function Ionicon({ color, size, ...props }) {
    return <Ionicons name={name} color={color} size={size} {...props} />;
  };
}

function materialIcon(name) {
  return function MaterialIcon({ color, size, ...props }) {
    return <MaterialCommunityIcons name={name} color={color} size={size} {...props} />;
  };
}

export const ArrowRight = featherIcon("arrow-right");
export const Bell = featherIcon("bell");
export const CheckCircle2 = featherIcon("check-circle");
export const Coins = materialIcon("cash-multiple");
export const Compass = featherIcon("compass");
export const Eye = featherIcon("eye");
export const EyeOff = featherIcon("eye-off");
export const House = featherIcon("home");
export const LogOut = featherIcon("log-out");
export const MailCheck = materialIcon("email-check-outline");
export const ShieldCheck = materialIcon("shield-check-outline");
export const TicketPercent = materialIcon("ticket-percent-outline");
export const UserRound = featherIcon("user");
export const Users = featherIcon("users");
export const Wallet = ionicon("wallet-outline");
export const WalletCards = materialIcon("wallet-outline");
