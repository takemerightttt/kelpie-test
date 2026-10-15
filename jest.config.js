/** Core logic and mock integration tests run in Node; UI is checked on devices. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  maxWorkers: 1,
  watchman: false,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, module: 'commonjs', target: 'es2022', types: ['jest', 'node'] } }] },
};
