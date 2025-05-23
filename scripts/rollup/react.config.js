import { getBaseRollupPlugins, getPackageJSON, resolvePkgPath } from "./utils";
import generatePackageJson from "rollup-plugin-generate-package-json";

const { name, module } = getPackageJSON("react");

// react 包的路径
const pkgPath = resolvePkgPath(name);

// react 打包后产物的路径
const distPath = resolvePkgPath(name, true);

export default [
  // react
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${distPath}/index.js`,
      name: 'React',
      format: "umd",
    },
    plugins: [
      ...getBaseRollupPlugins(),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: 'index.js'
        })
      })
    ]
  },
  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      {
        file: `${distPath}/jsx-runtime.js`,
        name:  `jsx-runtime`,
        format: 'umd',
      },
      // jsx-dev-runtime
      {
        file: `${distPath}/jsx-dev-runtime.js`,
        name:  `jsx-dev-runtime`,
        format: 'umd',
      }
    ],
    plugins: getBaseRollupPlugins()
  }
]