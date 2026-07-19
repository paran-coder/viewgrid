import "@testing-library/jest-dom/vitest";

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: () => "blob:viewgrid-test",
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: () => undefined,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});
