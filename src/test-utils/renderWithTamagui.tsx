// Helper de test partagé : wrap un composant Tamagui dans son TamaguiProvider.
// Sans ça, tout composant qui lit un thème (`$accentNeon`, `$background`, ...)
// plante avec "Missing theme." en environnement de test (pas de _layout.tsx racine).

import { render, type RenderOptions } from '@testing-library/react-native';
import React, { type ReactElement } from 'react';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '../../tamagui.config';

export function renderWithTamagui(ui: ReactElement, options?: RenderOptions) {
  return render(
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      {ui}
    </TamaguiProvider>,
    options
  );
}
