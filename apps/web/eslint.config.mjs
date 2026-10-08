import config from '../../packages/config/eslint.mjs';
export default [...config, { ignores: ['.next/**', 'upstream/**', 'next-env.d.ts'] }];
