/* global jest */
// Setup jest global.
//
// AsyncStorage n'a pas de module natif en environnement de test → il faut le
// mocker, sinon tout test qui importe (même indirectement) un store Zustand
// persisté plante au chargement (« NativeModule: AsyncStorage is null »).
// Mock officiel recommandé par la lib.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
