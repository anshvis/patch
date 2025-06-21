import { StyleSheet } from "react-native";
import SignInForm from "../../components/SignInForm";

export default function TabOneScreen() {
  return <SignInForm />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
