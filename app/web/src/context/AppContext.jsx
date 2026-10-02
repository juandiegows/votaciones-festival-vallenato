/* eslint-disable react-refresh/only-export-components */
// Punto de entrada de la capa de datos. El modo se elige al compilar con VITE_API_URL:
//  - sin definir → MockProvider (datos simulados en localStorage)
//  - definida    → ApiProvider (Django REST)
// Ambos exponen el mismo contrato (ver contexto.js), así que las pantallas no dependen del modo.
import { MODO_API } from '../config.js';
import { ApiProvider } from './ApiProvider.jsx';
import { MockProvider } from './MockProvider.jsx';

export { useApp } from './contexto.js';

export const AppProvider = MODO_API ? ApiProvider : MockProvider;
