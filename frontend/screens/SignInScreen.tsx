import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import SignInForm from "../components/SignInForm";

export default function SignInScreen() {
  const navigation = useNavigation();

  const handleSignInSuccess = (userData: any) => {
    // Navigate to Main screen only on successful login
    navigation.navigate("Main" as never);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>

      <SignInForm onSignInSuccess={handleSignInSuccess} />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    marginTop: 60,
    marginBottom: 40,
  },
  backButton: {
    marginTop: 20,
    alignItems: "center",
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 16,
  },
});
