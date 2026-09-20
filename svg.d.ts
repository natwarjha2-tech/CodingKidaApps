// Type declaration so TypeScript understands `import Xxx from './file.svg'`
// as a React component (react-native-svg-transformer turns SVGs into components).
declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: FC<SvgProps>;
  export default content;
}
