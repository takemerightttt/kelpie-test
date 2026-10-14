import { Text } from "react-native";
import { Card } from "./components";
import { styles } from "./styles";

export function SendingCard() {
  return (
    <Card title="Sending...">
      <Text style={styles.text}>Uploading the statement.</Text>
    </Card>
  );
}
