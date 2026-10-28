import '@testing-library/jest-dom/vitest';

// jsdom no implementa estas funciones del navegador.
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:prueba';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
