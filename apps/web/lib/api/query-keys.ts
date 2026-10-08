/** Account and resource scope must always be part of private query keys. */
export const queryKeys = {
  account: (userId: string) => ['account', userId] as const,
  resource: (userId: string, resource: string, ...context: unknown[]) =>
    ['account', userId, resource, ...context] as const,
};
