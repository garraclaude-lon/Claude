import '@testing-library/jest-dom/vitest';

// jsdom no implementa estas funciones del navegador.
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:prueba';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
// jsdom no tiene canvas ni WebGL: getContext devuelve null (como un navegador sin WebGL).
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
