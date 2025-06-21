import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { useUser } from "../components/UserContext";

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { setUser } = useUser();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    // Validation
    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.username ||
      !formData.password
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://10.0.0.64:8000/users/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          username: formData.username,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Registration failed");
      }

      const userData = await response.json();
      setUser(userData);
      navigation.navigate("Main" as never);
    } catch (error) {
      console.error("Sign up error:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Account</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            value={formData.first_name}
            onChangeText={(text) =>
              setFormData({ ...formData, first_name: text })
            }
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            value={formData.last_name}
            onChangeText={(text) =>
              setFormData({ ...formData, last_name: text })
            }
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={formData.username}
            onChangeText={(text) =>
              setFormData({ ...formData, username: text })
            }
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={formData.password}
            onChangeText={(text) =>
              setFormData({ ...formData, password: text })
            }
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) =>
              setFormData({ ...formData, confirmPassword: text })
            }
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Creating Account..." : "Sign Up"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
