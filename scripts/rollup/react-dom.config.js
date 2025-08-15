import alias from "@rollup/plugin-alias";
import { getBaseRollupPlugins, getPackageJSON, resolvePkgPath } from "./utils";
import generatePackageJson from "rollup-plugin-generate-package-json";

const { name, module, peerDependencies } = getPackageJSON("react-dom");

// react-dom 包的路径
const pkgPath = resolvePkgPath(name);

// react-dom 打包后产物的路径
const distPath = resolvePkgPath(name, true);

export default [
  // react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${distPath}/index.js`,
        name: 'ReactDOM',
        format: "umd",
      },
      {
        file: `${distPath}/client.js`,
        name: 'client',
        format: "umd",
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version
          },
          main: 'index.js'
        })
      })
    ]
  },
  // react-test-utils
  {
    input: `${pkgPath}/test-utils.ts`,
    output: [
      {
        file: `${distPath}/test-utils.js`,
        name: 'testUtils',
        format: "umd",
      }
    ],
    external: ['react-dom', 'react'],
    plugins: getBaseRollupPlugins()
  }
]