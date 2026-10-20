import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button, Card } from './ui';
import { colors } from '../theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Card>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.msg}>{String(this.state.error.message || this.state.error)}</Text>
            <Button title="Try again" onPress={() => this.setState({ error: null })} style={{ marginTop: 12 }} />
          </Card>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontWeight: '900', fontSize: 16, color: colors.text },
  msg: { color: colors.muted, marginTop: 6, lineHeight: 18 },
});
