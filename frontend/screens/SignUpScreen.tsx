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
import { useState, useEffect } from "react";
import { useUser } from "../components/UserContext";
import * as Contacts from "expo-contacts";

// Normalize phone number to match backend format
const normalizePhoneNumber = (phone: string): string => {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format as E.164 standard: +[country code][number]
  // For simplicity, assuming US/Canada numbers if no country code
  if (!digits.startsWith("1") && digits.length === 10) {
    return "+1" + digits;
  }

  return "+" + digits;
};

// Format phone number for display as (XXX) XXX-XXXX
const formatPhoneForDisplay = (input: string): string => {
  // Strip all non-digit characters
  const digits = input.replace(/\D/g, "");

  // Don't format if we don't have enough digits
  if (digits.length < 10) return digits;

  // Format as (XXX) XXX-XXXX for US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // If it has country code (e.g., 1XXXXXXXXXX)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
      7
    )}`;
  }

  // For other international numbers, just add the plus
  return `+${digits}`;
};

export default function SignUpScreen() {
  const navigation = useNavigation();
  const { setUser } = useUser();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [formattedPhone, setFormattedPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // Format phone number for display as user types
  useEffect(() => {
    if (formData.phone_number) {
      setFormattedPhone(formatPhoneForDisplay(formData.phone_number));
    }
  }, [formData.phone_number]);

  const handlePhoneChange = (text: string) => {
    // Store raw digits in formData
    setFormData({ ...formData, phone_number: text.replace(/\D/g, "") });
  };

  const handleSignUp = async () => {
    // Validation
    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.phone_number ||
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

    // Phone number validation and normalization
    const phoneDigits = formData.phone_number.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      Alert.alert("Error", "Please enter a valid phone number (10-15 digits)");
      return;
    }

    // Normalize the phone number to match backend format
    const normalizedPhone = normalizePhoneNumber(formData.phone_number);

    // Debug log
    console.log("Signing up with normalized phone:", normalizedPhone);

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
          phone_number: normalizedPhone,
          username: formData.username,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Registration failed");
      }

      const userData = await response.json();
      console.log("Registration successful, user data:", userData);
      setUser(userData);

      // Ask for contacts permission after successful signup
      requestContactsPermission();

      // Navigate to the onboarding screen instead of Main
      navigation.navigate("Onboarding" as never);
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

  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === "granted") {
        Alert.alert(
          "Contacts Access Granted",
          "You can now connect with friends from your contacts!"
        );
      } else {
        Alert.alert(
          "Contacts Access Denied",
          "To connect with friends from your contacts, please enable contacts access in settings."
        );
      }
    } catch (error) {
      console.error("Error requesting contacts permission:", error);
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
            placeholder="Phone Number"
            value={formattedPhone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
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
  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: -10,
    marginBottom: 15,
    marginLeft: 5,
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
