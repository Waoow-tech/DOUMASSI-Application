// GameWebView — E10-02 (#293)
//
// Charge un jeu HTML5 auto-contenu dans une WebView et relaie les messages
// postMessage du jeu ({ type: 'score', value } / { type: 'gameover' }).
//
// Le HTML est passé inline (source={{ html }}) → offline, pas d'hébergement.

import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { logger } from '@/lib/logger';

export interface GameWebViewProps {
  html: string;
  /** Appelé quand le jeu envoie un score (fin de partie en général). */
  onScore?: (value: number) => void;
  onGameOver?: () => void;
}

export function GameWebView({ html, onScore, onGameOver }: GameWebViewProps) {
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as { type?: string; value?: unknown };
        if (msg.type === 'score' && typeof msg.value === 'number') {
          onScore?.(msg.value);
        } else if (msg.type === 'gameover') {
          onGameOver?.();
        }
      } catch (err) {
        logger.warn('GameWebView bad message', { message: String(err) });
      }
    },
    [onScore, onGameOver]
  );

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        style={styles.web}
        // Jeux auto-contenus : pas de scroll ni de zoom.
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        setSupportMultipleWindows={false}
        // Fond noir pendant le chargement pour éviter le flash blanc.
        containerStyle={styles.container}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  web: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
