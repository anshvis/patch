import { StyleSheet, View, Dimensions, Alert } from "react-native";
import MapView, { Region } from "react-native-maps";
import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import { useUser } from "../components/UserContext";

export default function HomeScreen() {
  const { user, updateUserLocation } = useUser();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef<MapView>(null);

  // Debug log for user object
  useEffect(() => {
    console.log("HomeScreen user state:", user);
  }, [user]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;

    const startLocationTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        Alert.alert(
          "Permission Denied",
          "Location permission is required to show your position on the map."
        );
        return;
      }

      let initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(initialLocation);

      // Update the region with the initial location
      const newRegion = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);

      // Update the user's location in the backend if logged in
      if (user) {
        console.log("Updating initial location for user:", user.id);
        try {
          await updateUserLocation(
            initialLocation.coords.latitude,
            initialLocation.coords.longitude
          );
        } catch (error) {
          console.error("Error updating initial location:", error);
        }
      } else {
        console.log("No user logged in, skipping location update");
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update if moved by 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);

          const newRegion = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setRegion(newRegion);

          // Update the user's location in the backend if logged in
          if (user) {
            console.log("Updating location on movement for user:", user.id);
            updateUserLocation(
              newLocation.coords.latitude,
              newLocation.coords.longitude
            ).catch((error) => {
              console.error("Error updating location on movement:", error);
            });
          }
        }
      );
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [user, updateUserLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
